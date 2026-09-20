import {
  adjustedDeductionYen,
  needsDeemedService,
  reverseDeemedYears,
  statutoryDeductionYen,
} from "./deduction";
import {
  assertValidInterval,
  clipFromStart,
  intersectIntervals,
  mergeIntervals,
  overlapYearsFromMonths,
  reconstructSimpleInterval,
  serviceYearsFromMonths,
  totalMonths,
} from "./months";
import { defaultRuleset } from "./ruleset";
import { taxOnRetirementIncome } from "./tax";
import type {
  AdjustmentCategory,
  BenefitInput,
  BenefitKind,
  CalculationStep,
  MonthInterval,
  RuleMode,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
  TaxRuleset,
  YearMonth,
  YearTaxResult,
} from "./types";

const SHORT_TENURE_YEARS = 5;

export type ResolvedBenefit = BenefitInput & {
  intervals: MonthInterval[];
};

export function categoryOf(kind: BenefitKind): AdjustmentCategory {
  return kind === "dc" ? "dc" : "general";
}

export function yearOfAge(birth: YearMonth, age: number): number {
  return birth.year + age;
}

export function ageInCalendarYear(birth: YearMonth, year: number): number {
  return year - birth.year;
}

function extendForContributionEnd(
  intervals: MonthInterval[],
  benefit: BenefitInput,
  birth?: YearMonth,
): MonthInterval[] {
  if (benefit.kind !== "dc" || benefit.contributionEndAge === undefined || !birth) {
    return intervals;
  }
  const endYear = yearOfAge(birth, benefit.contributionEndAge);
  const merged = mergeIntervals(intervals);
  if (merged.length === 0) return merged;
  const last = merged[merged.length - 1];
  if (last.end.year < endYear || (last.end.year === endYear && last.end.month < 12)) {
    merged[merged.length - 1] = {
      start: last.start,
      end: { year: endYear, month: 12 },
    };
  }
  return mergeIntervals(merged);
}

export function resolveBenefitIntervals(
  benefit: BenefitInput,
  birth?: YearMonth,
): MonthInterval[] {
  let intervals: MonthInterval[];
  if (benefit.intervals && benefit.intervals.length > 0) {
    intervals = mergeIntervals(benefit.intervals);
  } else if (benefit.serviceYears !== undefined) {
    intervals = [reconstructSimpleInterval(benefit.serviceYears, benefit.receiptYear)];
  } else {
    throw new Error(`手当 ${benefit.id} に勤続期間がありません`);
  }
  for (const interval of intervals) {
    assertValidInterval(interval);
  }
  return extendForContributionEnd(intervals, benefit, birth);
}

export function resolveBenefits(
  input: SimulationInput,
): ResolvedBenefit[] {
  return input.benefits.map((benefit) => ({
    ...benefit,
    intervals: resolveBenefitIntervals(benefit, input.birthYearMonth),
  }));
}

/** 受取年だけ動かす比較用。簡易入力の勤続期間を受取年に追随させない。 */
export function freezeServiceIntervals(input: SimulationInput): SimulationInput {
  return {
    ...input,
    benefits: resolveBenefits(input).map((benefit) => ({
      ...benefit,
      serviceYears: undefined,
    })),
  };
}

function usesPostAmendment(
  paymentYear: number,
  ruleMode: RuleMode,
  ruleset: TaxRuleset,
): boolean {
  if (ruleMode === "pre_2026") return false;
  if (ruleMode === "post_2026") return true;
  return paymentYear >= ruleset.amendmentEffectiveYear;
}

export function lookbackYears(args: {
  currentCategory: AdjustmentCategory;
  priorCategory: AdjustmentCategory;
  paymentYear: number;
  ruleMode: RuleMode;
  ruleset: TaxRuleset;
}): number {
  if (args.currentCategory === "dc") return args.ruleset.windows.dcToAny;
  if (args.priorCategory === "dc") {
    return usesPostAmendment(args.paymentYear, args.ruleMode, args.ruleset)
      ? args.ruleset.windows.generalToDcPostAmendment
      : args.ruleset.windows.generalToDcPreAmendment;
  }
  return args.ruleset.windows.generalToGeneral;
}

function priorInWindow(
  currentYear: number,
  priorYear: number,
  n: number,
): boolean {
  const gap = currentYear - priorYear;
  return gap >= 1 && gap <= n;
}

type PriorLump = {
  year: number;
  category: AdjustmentCategory;
  incomeYen: number;
  intervals: MonthInterval[];
  serviceYears: number;
};

function deemedIntervals(
  lump: PriorLump,
  ruleset: TaxRuleset,
): { intervals: MonthInterval[]; deemed: boolean; deemedYears: number | null } {
  if (!needsDeemedService(lump.incomeYen, lump.serviceYears, ruleset)) {
    return { intervals: lump.intervals, deemed: false, deemedYears: null };
  }
  const n = reverseDeemedYears(lump.incomeYen, ruleset);
  return {
    intervals: clipFromStart(lump.intervals, n),
    deemed: true,
    deemedYears: n,
  };
}

function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}

function computeYear(args: {
  year: number;
  current: ResolvedBenefit[];
  priors: PriorLump[];
  ruleMode: RuleMode;
  ruleset: TaxRuleset;
}): YearTaxResult {
  const { year, current, priors, ruleMode, ruleset } = args;
  const intervals = mergeIntervals(current.flatMap((b) => b.intervals));
  const serviceMonths = totalMonths(intervals);
  const serviceYears = serviceYearsFromMonths(serviceMonths);
  const incomeYen = current.reduce((sum, b) => sum + b.incomeYen, 0);
  const disability = current.some((b) => b.disability);
  const currentCategories = [...new Set(current.map((b) => categoryOf(b.kind)))];
  const steps: CalculationStep[] = [];
  const notes: string[] = [];

  steps.push({
    code: "income",
    label: "本年分の収入",
    formula: "同一年の退職手当等を合算",
    substituted: current.map((b) => `${b.id}:${yen(b.incomeYen)}`).join(" + "),
    resultYen: incomeYen,
  });
  steps.push({
    code: "service",
    label: "勤続年数（切上げ）",
    formula: "月数 = (終了年−開始年)×12 + (終了月−開始月) + 1。余り1以上なら年切上げ",
    substituted: `${serviceMonths}か月`,
    resultMonths: serviceMonths,
    resultYears: serviceYears,
  });

  const statutory = statutoryDeductionYen(serviceYears, ruleset);
  steps.push({
    code: "statutory",
    label: "退職所得控除（30条3項・調整前）",
    formula:
      serviceYears <= ruleset.longServiceThresholdYears
        ? "40万円 × 勤続年数"
        : "800万円 + 70万円 × (勤続年数 − 20)",
    substituted: `${serviceYears}年`,
    resultYen: statutory,
    resultYears: serviceYears,
  });

  const qualifying: Array<{
    lump: PriorLump;
    n: number;
    deemed: boolean;
    deemedYears: number | null;
    intervals: MonthInterval[];
  }> = [];

  for (const lump of priors) {
    const windows = currentCategories.map((currentCategory) =>
      lookbackYears({
        currentCategory,
        priorCategory: lump.category,
        paymentYear: year,
        ruleMode,
        ruleset,
      }),
    );
    const n = Math.max(...windows);
    if (!priorInWindow(year, lump.year, n)) continue;
    const clipped = deemedIntervals(lump, ruleset);
    qualifying.push({ lump, n, ...clipped });
  }

  const priorUnion = mergeIntervals(qualifying.flatMap((q) => q.intervals));
  const overlapIntervals = intersectIntervals(intervals, priorUnion);
  const overlapMonths = totalMonths(overlapIntervals);
  const overlapYears = overlapYearsFromMonths(overlapMonths);
  const overlapDeductionYen = statutoryDeductionYen(overlapYears, ruleset);
  const deductionAfterAdjustmentYen = adjustedDeductionYen({
    serviceYears,
    overlapYears,
    disability,
    ruleset,
  });

  steps.push({
    code: "overlap_years",
    label: "重複年数（切捨て）",
    formula: "本年の勤続月 ∩ 対象となる前の勤続月（みなし後）。月数÷12の商",
    substituted: `${overlapMonths}か月`,
    resultMonths: overlapMonths,
    resultYears: overlapYears,
  });
  steps.push({
    code: "overlap_deduction",
    label: "重複期間の控除（80万下限なし）",
    formula: "重複年数を勤続年数とみなした30条3項。年数差で控除を計算しない",
    substituted: `${overlapYears}年`,
    resultYen: overlapDeductionYen,
  });
  steps.push({
    code: "adjusted_deduction",
    label: "調整後の退職所得控除",
    formula: "max(30条3項 − 重複控除, 80万円) + 障害100万円",
    substituted: `${yen(statutory)} − ${yen(overlapDeductionYen)}`,
    resultYen: deductionAfterAdjustmentYen,
  });

  for (const q of qualifying) {
    notes.push(
      `${q.lump.year}年の${q.lump.category === "dc" ? "DC" : "一般"}を前年以前${q.n}年内として算入` +
        (q.deemed ? `（みなし勤続${q.deemedYears}年）` : ""),
    );
  }

  const shortTenure =
    serviceYears <= SHORT_TENURE_YEARS ||
    current.some((b) => serviceYearsFromMonths(totalMonths(b.intervals)) <= SHORT_TENURE_YEARS);

  const base: Omit<
    YearTaxResult,
    | "status"
    | "taxableYen"
    | "incomeTaxYen"
    | "reconstructionTaxYen"
    | "municipalTaxYen"
    | "prefecturalTaxYen"
    | "residentTaxYen"
    | "nationalTaxYen"
    | "totalTaxYen"
    | "netYen"
  > = {
    year,
    benefitIds: current.map((b) => b.id),
    kinds: current.map((b) => b.kind),
    incomeYen,
    serviceMonths,
    serviceYears,
    statutoryDeductionYen: statutory,
    overlapYears,
    overlapDeductionYen,
    deductionAfterAdjustmentYen,
    steps,
    notes,
  };

  if (shortTenure) {
    notes.push("勤続5年以下のため税額は出しません（特定役員・短期退職手当等は未対応）");
    return {
      ...base,
      status: "tenure_out_of_scope",
      taxableYen: null,
      incomeTaxYen: null,
      reconstructionTaxYen: null,
      municipalTaxYen: null,
      prefecturalTaxYen: null,
      residentTaxYen: null,
      nationalTaxYen: null,
      totalTaxYen: null,
      netYen: null,
    };
  }

  const tax = taxOnRetirementIncome({
    incomeYen,
    deductionYen: deductionAfterAdjustmentYen,
    paymentYear: year,
    ruleset,
  });
  steps.push({
    code: "taxable",
    label: "課税退職所得金額",
    formula: "floor((収入 − 控除) × 1/2, 1000円)。残額が0以下なら0",
    substituted: `(${yen(incomeYen)} − ${yen(deductionAfterAdjustmentYen)}) × 1/2`,
    resultYen: tax.taxableYen,
  });
  steps.push({
    code: "national",
    label: "所得税および復興特別所得税",
    formula: "floor((A×税率 − 控除額) × 102.1%)。途中切捨てなし。2038年以後は復興税0",
    substituted: `課税所得 ${yen(tax.taxableYen)}`,
    resultYen: tax.nationalTaxYen,
  });
  steps.push({
    code: "resident",
    label: "住民税",
    formula: "市町村民税6%と道府県民税4%を別々に掛け、それぞれ100円未満切捨て",
    substituted: `課税所得 ${yen(tax.taxableYen)}`,
    resultYen: tax.residentTaxYen,
  });

  return {
    ...base,
    status: "ok",
    taxableYen: tax.taxableYen,
    incomeTaxYen: tax.incomeTaxYen,
    reconstructionTaxYen: tax.reconstructionTaxYen,
    municipalTaxYen: tax.municipalTaxYen,
    prefecturalTaxYen: tax.prefecturalTaxYen,
    residentTaxYen: tax.residentTaxYen,
    nationalTaxYen: tax.nationalTaxYen,
    totalTaxYen: tax.totalTaxYen,
    netYen: tax.netYen,
  };
}

export function simulate(
  input: SimulationInput,
  ruleset: TaxRuleset = defaultRuleset,
): SimulationResult {
  const warnings: SimulationWarning[] = [];
  if (input.benefits.length === 0) {
    return {
      schemaVersion: 1,
      rulesetVersion: ruleset.version,
      years: [],
      totalTaxYen: 0,
      totalNetYen: 0,
      warnings: [{ code: "no_benefits", message: "退職手当等がありません" }],
    };
  }

  const resolved = resolveBenefits(input);
  const byYear = new Map<number, ResolvedBenefit[]>();
  for (const benefit of resolved) {
    const list = byYear.get(benefit.receiptYear) ?? [];
    list.push(benefit);
    byYear.set(benefit.receiptYear, list);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const priors: PriorLump[] = [];
  const yearResults: YearTaxResult[] = [];

  for (const year of years) {
    const current = byYear.get(year) ?? [];
    const result = computeYear({
      year,
      current,
      priors,
      ruleMode: input.ruleMode,
      ruleset,
    });
    yearResults.push(result);

    const grouped = new Map<AdjustmentCategory, ResolvedBenefit[]>();
    for (const benefit of current) {
      const cat = categoryOf(benefit.kind);
      const list = grouped.get(cat) ?? [];
      list.push(benefit);
      grouped.set(cat, list);
    }
    for (const [category, group] of grouped) {
      const intervals = mergeIntervals(group.flatMap((b) => b.intervals));
      priors.push({
        year,
        category,
        incomeYen: group.reduce((sum, b) => sum + b.incomeYen, 0),
        intervals,
        serviceYears: serviceYearsFromMonths(totalMonths(intervals)),
      });
    }
  }

  if (resolved.some((b) => b.kind === "mutual_aid")) {
    warnings.push({
      code: "mutual_aid",
      message:
        "小規模企業共済は一般の退職金と同じ式で計算します。任意解約が退職所得にならない場合があります。受取年は自動では動かしません。",
    });
  }
  if (resolved.some((b) => b.kind === "dc")) {
    warnings.push({
      code: "dc_age_note",
      message:
        "iDeCo/企業型DCの60歳は、その年に誕生日を迎える暦年です。実際の受取は誕生月以降です。通算加入者等期間が10年未満だと開始年齢が繰り下がることがあります。",
    });
    warnings.push({
      code: "dc_2026_12",
      message:
        "2026年12月の加入可能年齢拡大（70歳未満）は注意書きのみで、探索の加入上限には入れていません。見込み受取額は固定し、動かすのは拠出年数だけです。",
    });
  }

  const outOfScope = yearResults.some((y) => y.status === "tenure_out_of_scope");
  const totalTaxYen = outOfScope
    ? null
    : yearResults.reduce((sum, y) => sum + (y.totalTaxYen ?? 0), 0);
  const totalNetYen = outOfScope
    ? null
    : yearResults.reduce((sum, y) => sum + (y.netYen ?? 0), 0);

  return {
    schemaVersion: 1,
    rulesetVersion: ruleset.version,
    years: yearResults,
    totalTaxYen,
    totalNetYen,
    warnings,
  };
}
