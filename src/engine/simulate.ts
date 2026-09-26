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
import { dcMinimumReceiptAgeFromMonths, EARLIEST_RETIREMENT_AGE } from "./dc-age";
import { explainYear } from "./explain";
import { defaultRuleset } from "./ruleset";
import { incomeTaxBracket, taxOnRetirementIncome } from "./tax";
import type {
  AdjustmentCategory,
  BenefitInput,
  BenefitKind,
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
  const requestedYear = yearOfAge(birth, benefit.contributionEndAge);
  const endYear = Math.min(requestedYear, benefit.receiptYear);
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

function benefitName(benefit: BenefitInput): string {
  if (benefit.label && benefit.label.trim() !== "") return benefit.label;
  switch (benefit.kind) {
    case "company":
      return "会社退職金";
    case "dc":
      return "iDeCo・企業型DC一時金";
    case "mutual_aid":
      return "小規模企業共済";
    case "other":
      return "その他";
    default: {
      const unreachable: never = benefit.kind;
      return unreachable;
    }
  }
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

/**
 * 候補の受取年で拠出を打ち切った区間。
 * 年月区間は元の区間からその年まで延ばす。簡易入力は元の受取年に固定した区間のまま。
 */
function intervalsAtReceipt(
  benefit: BenefitInput,
  receiptYear: number,
  birth?: YearMonth,
): MonthInterval[] {
  if (benefit.intervals && benefit.intervals.length > 0) {
    return resolveBenefitIntervals({ ...benefit, receiptYear }, birth);
  }
  return resolveBenefitIntervals(benefit, birth);
}

export function membershipMonthsAtReceipt(
  benefit: BenefitInput,
  birth: YearMonth | undefined,
  receiptYear: number,
): number {
  return totalMonths(intervalsAtReceipt(benefit, receiptYear, birth));
}

export function benefitAtReceiptYear(
  benefit: BenefitInput,
  receiptYear: number,
  birth?: YearMonth,
): BenefitInput {
  return {
    ...benefit,
    receiptYear,
    optimizeReceiptYear: false,
    intervals: intervalsAtReceipt(benefit, receiptYear, birth),
    serviceYears: undefined,
  };
}

export function dcReceiptAgeAllowed(
  benefit: BenefitInput,
  receiptYear: number,
  birth: YearMonth | undefined,
  ruleset: TaxRuleset,
): boolean {
  if (benefit.kind !== "dc" || !birth) return true;
  const age = ageInCalendarYear(birth, receiptYear);
  if (age < EARLIEST_RETIREMENT_AGE || age > ruleset.dcReceiptAgeMax) return false;
  const minAge = dcMinimumReceiptAgeFromMonths(
    membershipMonthsAtReceipt(benefit, birth, receiptYear),
    ruleset,
  );
  return age >= minAge;
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

function hasShortTenure(current: ResolvedBenefit[], unionYears: number): boolean {
  if (unionYears <= SHORT_TENURE_YEARS) return true;
  return current.some(
    (b) => serviceYearsFromMonths(totalMonths(b.intervals)) <= SHORT_TENURE_YEARS,
  );
}

function receiptBlockMessage(
  benefit: ResolvedBenefit,
  birth: YearMonth | undefined,
  ruleset: TaxRuleset,
): string | null {
  if (!birth) return null;
  const age = ageInCalendarYear(birth, benefit.receiptYear);
  const name = benefitName(benefit);
  if (age < EARLIEST_RETIREMENT_AGE) {
    return `${name}の受取年齢${age}歳は、退職しうる年齢（${EARLIEST_RETIREMENT_AGE}歳）より前です。`;
  }
  if (benefit.kind !== "dc") return null;
  const minAge = dcMinimumReceiptAgeFromMonths(totalMonths(benefit.intervals), ruleset);
  if (age < minAge || age > ruleset.dcReceiptAgeMax) {
    return `${name}の受取年齢${age}歳は受けられません。受けられるのは${minAge}歳から${ruleset.dcReceiptAgeMax}歳です。`;
  }
  return null;
}

function contributionNotes(
  benefits: BenefitInput[],
  birth: YearMonth | undefined,
  ruleset: TaxRuleset,
): SimulationWarning[] {
  if (!birth) return [];
  const notes: SimulationWarning[] = [];
  for (const benefit of benefits) {
    if (benefit.kind !== "dc" || benefit.contributionEndAge === undefined) continue;
    const requestedYear = yearOfAge(birth, benefit.contributionEndAge);
    const name = benefitName(benefit);
    if (requestedYear > benefit.receiptYear) {
      notes.push({
        code: `contribution_end_${benefit.id}`,
        message: `${name}の拠出終了${benefit.contributionEndAge}歳は受取年より後です。受取年を超える拠出は控除に入れていません。見込み受取額は固定です。`,
      });
    }
    let baseline: MonthInterval[];
    let extended: MonthInterval[];
    try {
      baseline = resolveBenefitIntervals({ ...benefit, contributionEndAge: undefined }, birth);
      extended = resolveBenefitIntervals(benefit, birth);
    } catch {
      continue;
    }
    const baseYears = serviceYearsFromMonths(totalMonths(baseline));
    const nextYears = serviceYearsFromMonths(totalMonths(extended));
    if (nextYears <= baseYears) continue;
    const baseDeduction = statutoryDeductionYen(baseYears, ruleset);
    const nextDeduction = statutoryDeductionYen(nextYears, ruleset);
    notes.push({
      code: `contribution_extend_${benefit.id}`,
      message: `${name}の拠出終了を${benefit.contributionEndAge}歳にすると、加入年数は${baseYears}年から${nextYears}年になります（+${nextYears - baseYears}年）。控除は${baseDeduction.toLocaleString("ja-JP")}円から${nextDeduction.toLocaleString("ja-JP")}円です（+${(nextDeduction - baseDeduction).toLocaleString("ja-JP")}円）。見込み受取額は固定です。`,
    });
  }
  return notes;
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
  const statutory = statutoryDeductionYen(serviceYears, ruleset);

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
  const overlapMonths = totalMonths(intersectIntervals(intervals, priorUnion));
  const overlapYears = overlapYearsFromMonths(overlapMonths);
  const overlapDeductionYen = statutoryDeductionYen(overlapYears, ruleset);
  const deductionAfterAdjustmentYen = adjustedDeductionYen({
    serviceYears,
    overlapYears,
    disability,
    ruleset,
  });
  const shortTenure = hasShortTenure(current, serviceYears);

  const tax = shortTenure
    ? null
    : taxOnRetirementIncome({
        incomeYen,
        deductionYen: deductionAfterAdjustmentYen,
        paymentYear: year,
        ruleset,
      });
  const bracket = tax ? incomeTaxBracket(tax.taxableYen, ruleset) : null;

  const { steps, notes } = explainYear({
    benefits: current.map((benefit) => ({
      name: benefitName(benefit),
      receiptYear: benefit.receiptYear,
      incomeYen: benefit.incomeYen,
      intervals: benefit.intervals,
    })),
    serviceMonths,
    serviceYears,
    statutoryDeductionYen: statutory,
    overlapMonths,
    overlapYears,
    overlapDeductionYen,
    deductionAfterAdjustmentYen,
    longServiceThresholdYears: ruleset.longServiceThresholdYears,
    qualifying: qualifying.map((q) => ({
      year: q.lump.year,
      category: q.lump.category,
      n: q.n,
      deemed: q.deemed,
      deemedYears: q.deemedYears,
      intervals: q.intervals,
    })),
    shortTenure,
    taxableYen: tax?.taxableYen,
    nationalTaxYen: tax?.nationalTaxYen,
    residentTaxYen: tax?.residentTaxYen,
    taxRateBp: bracket?.rateBp,
    quickDeductionYen: bracket?.deductionYen,
  });

  return {
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
    status: tax ? "ok" : "tenure_out_of_scope",
    taxableYen: tax?.taxableYen ?? null,
    incomeTaxYen: tax?.incomeTaxYen ?? null,
    reconstructionTaxYen: tax?.reconstructionTaxYen ?? null,
    municipalTaxYen: tax?.municipalTaxYen ?? null,
    prefecturalTaxYen: tax?.prefecturalTaxYen ?? null,
    residentTaxYen: tax?.residentTaxYen ?? null,
    nationalTaxYen: tax?.nationalTaxYen ?? null,
    totalTaxYen: tax?.totalTaxYen ?? null,
    netYen: tax?.netYen ?? null,
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
  const ineligibleIds = new Set<string>();
  const blockedMessages: string[] = [];
  for (const benefit of resolved) {
    const message = receiptBlockMessage(benefit, input.birthYearMonth, ruleset);
    if (!message) continue;
    ineligibleIds.add(benefit.id);
    blockedMessages.push(message);
  }
  const blockedOnlyYears = new Set<number>();

  for (const year of years) {
    const current = byYear.get(year) ?? [];
    const eligible = current.filter((benefit) => !ineligibleIds.has(benefit.id));
    const counted = eligible.length > 0 ? eligible : current;
    if (eligible.length === 0) blockedOnlyYears.add(year);
    const result = computeYear({
      year,
      current: counted,
      priors,
      ruleMode: input.ruleMode,
      ruleset,
    });
    yearResults.push(result);
    if (eligible.length === 0) continue;

    const grouped = new Map<AdjustmentCategory, ResolvedBenefit[]>();
    for (const benefit of eligible) {
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
  if (blockedMessages.length > 0) {
    warnings.push({ code: "receipt_ineligible", message: blockedMessages.join("") });
  }
  warnings.push(...contributionNotes(input.benefits, input.birthYearMonth, ruleset));
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

  const hadShortTenure = yearResults.some(
    (year) => !blockedOnlyYears.has(year.year) && year.status === "tenure_out_of_scope",
  );
  const pricedYears = yearResults.map((year) => {
    if (!blockedOnlyYears.has(year.year)) return year;
    return {
      ...year,
      status: "receipt_ineligible" as const,
      taxableYen: null,
      incomeTaxYen: null,
      reconstructionTaxYen: null,
      municipalTaxYen: null,
      prefecturalTaxYen: null,
      residentTaxYen: null,
      nationalTaxYen: null,
      totalTaxYen: null,
      netYen: null,
      notes: [...year.notes, "受取できない年齢のため、税額は出していません。"],
    };
  });
  const priced = pricedYears.filter((year) => year.totalTaxYen !== null);
  const totalTaxYen =
    hadShortTenure || priced.length === 0
      ? null
      : priced.reduce((sum, year) => sum + (year.totalTaxYen ?? 0), 0);
  const totalNetYen =
    hadShortTenure || priced.length === 0
      ? null
      : priced.reduce((sum, year) => sum + (year.netYen ?? 0), 0);

  return {
    schemaVersion: 1,
    rulesetVersion: ruleset.version,
    years: pricedYears,
    totalTaxYen,
    totalNetYen,
    warnings,
  };
}
