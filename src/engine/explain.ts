import type { CalculationStep, MonthInterval, TaxRuleset } from "./types";

function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}

export function formatMonthIntervals(intervals: MonthInterval[]): string {
  if (intervals.length === 0) return "期間なし";
  return intervals
    .map(
      (interval) =>
        `${interval.start.year}年${interval.start.month}月〜${interval.end.year}年${interval.end.month}月`,
    )
    .join("、");
}

export type QualifyingPrior = {
  year: number;
  category: "dc" | "general";
  n: number;
  deemed: boolean;
  deemedYears: number | null;
  intervals: MonthInterval[];
};

export type ExplainedBenefit = {
  name: string;
  receiptYear: number;
  incomeYen: number;
  intervals: MonthInterval[];
};

export function explainYear(args: {
  benefits: ExplainedBenefit[];
  serviceMonths: number;
  serviceYears: number;
  statutoryDeductionYen: number;
  overlapMonths: number;
  overlapYears: number;
  overlapDeductionYen: number;
  deductionAfterAdjustmentYen: number;
  longServiceThresholdYears: number;
  qualifying: QualifyingPrior[];
  shortTenure: boolean;
  taxableYen?: number;
  nationalTaxYen?: number;
  residentTaxYen?: number;
  taxRateBp?: number;
  quickDeductionYen?: number;
}): { steps: CalculationStep[]; notes: string[] } {
  const incomeYen = args.benefits.reduce((sum, benefit) => sum + benefit.incomeYen, 0);
  const steps: CalculationStep[] = [
    {
      code: "income",
      label: "本年分の収入",
      formula: "同一年の退職手当等を合算",
      substituted: args.benefits
        .map((benefit) => `${benefit.name}（${benefit.receiptYear}年）: ${yen(benefit.incomeYen)}`)
        .join(" + "),
      resultYen: incomeYen,
    },
    {
      code: "periods",
      label: "対象期間",
      formula: "手当ごとの勤続・拠出区間。重なる月は二重に数えない",
      substituted: args.benefits
        .map((benefit) => `${benefit.name}（${benefit.receiptYear}年） ${formatMonthIntervals(benefit.intervals)}`)
        .join("。"),
    },
    {
      code: "service",
      label: "勤続年数（切上げ）",
      formula: "月数 = (終了年−開始年)×12 + (終了月−開始月) + 1。余り1以上なら年切上げ",
      substituted: `${args.serviceMonths}か月`,
      resultMonths: args.serviceMonths,
      resultYears: args.serviceYears,
    },
    {
      code: "statutory",
      label: "退職所得控除（30条3項・調整前）",
      formula:
        args.serviceYears <= args.longServiceThresholdYears
          ? "40万円 × 勤続年数"
          : "800万円 + 70万円 × (勤続年数 − 20)",
      substituted: `${args.serviceYears}年`,
      resultYen: args.statutoryDeductionYen,
      resultYears: args.serviceYears,
    },
    {
      code: "overlap_years",
      label: "重複年数（切捨て）",
      formula: "本年の勤続月 ∩ 対象となる前の勤続月（みなし後）。月数÷12の商",
      substituted:
        args.qualifying.length === 0
          ? `${args.overlapMonths}か月`
          : `${args.overlapMonths}か月。${args.qualifying
              .map(
                (prior) =>
                  `${prior.year}年の${prior.category === "dc" ? "DC" : "一般"} ${formatMonthIntervals(prior.intervals)}`,
              )
              .join("、")}`,
      resultMonths: args.overlapMonths,
      resultYears: args.overlapYears,
    },
    {
      code: "overlap_deduction",
      label: "重複期間の控除（80万下限なし）",
      formula: "重複年数を勤続年数とみなした30条3項。年数差で控除を計算しない",
      substituted: `${args.overlapYears}年`,
      resultYen: args.overlapDeductionYen,
    },
    {
      code: "adjusted_deduction",
      label: "調整後の退職所得控除",
      formula: "max(30条3項 − 重複控除, 80万円) + 障害100万円",
      substituted: `${yen(args.statutoryDeductionYen)} − ${yen(args.overlapDeductionYen)}`,
      resultYen: args.deductionAfterAdjustmentYen,
    },
  ];

  if (args.taxableYen !== undefined) {
    const rate =
      args.taxRateBp === undefined ? null : `${args.taxRateBp / 10}%`;
    const quick =
      args.quickDeductionYen === undefined ? null : yen(args.quickDeductionYen);
    steps.push(
      {
        code: "taxable",
        label: "課税退職所得金額",
        formula: "floor((収入 − 控除) × 1/2, 1000円)。残額が0以下なら0",
        substituted: `(${yen(incomeYen)} − ${yen(args.deductionAfterAdjustmentYen)}) × 1/2`,
        resultYen: args.taxableYen,
      },
      {
        code: "national",
        label: "所得税および復興特別所得税",
        formula: "floor((A×税率 − 速算控除) × 102.1%)。途中切捨てなし。2038年以後は復興税0",
        substituted:
          rate !== null && quick !== null
            ? `課税所得 ${yen(args.taxableYen)} × 税率 ${rate} − 速算控除 ${quick}`
            : `課税所得 ${yen(args.taxableYen)}`,
        resultYen: args.nationalTaxYen,
      },
      {
        code: "resident",
        label: "住民税",
        formula: "市町村民税6%と道府県民税4%を別々に掛け、それぞれ100円未満切捨て",
        substituted: `課税所得 ${yen(args.taxableYen)}`,
        resultYen: args.residentTaxYen,
      },
    );
  }

  const notes = args.qualifying.map((prior) => {
    const category = prior.category === "dc" ? "DC" : "一般";
    const deemed = prior.deemed ? `（みなし勤続${prior.deemedYears}年）` : "";
    const period =
      prior.intervals.length > 0 ? `。対象期間 ${formatMonthIntervals(prior.intervals)}` : "";
    return `${prior.year}年の${category}を前年以前${prior.n}年内として算入${deemed}${period}`;
  });
  if (args.shortTenure) {
    notes.push("勤続5年以下のため税額は出しません（特定役員・短期退職手当等は未対応）");
  }
  return { steps, notes };
}

export function dcReceiptYears(
  birthYear: number,
  ruleset: Pick<TaxRuleset, "dcReceiptAgeMin" | "dcReceiptAgeMax">,
  minAge = ruleset.dcReceiptAgeMin,
): number[] {
  const years: number[] = [];
  const start = Math.max(ruleset.dcReceiptAgeMin, minAge);
  for (let age = start; age <= ruleset.dcReceiptAgeMax; age += 1) {
    years.push(birthYear + age);
  }
  return years;
}
