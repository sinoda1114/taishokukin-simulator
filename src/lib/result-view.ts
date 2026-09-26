import {
  defaultRuleset,
  formatMonthIntervals,
  resolveBenefitIntervals,
  type BenefitInput,
  type PatternComparison,
  type RuleMode,
  type SearchResult,
  type SimulationResult,
  type YearMonth,
} from "@/engine";
import { KIND_LABELS, RULE_MODE_LABELS, formatYen } from "@/lib/parse-input";

export type PatternCardView = {
  pattern: PatternComparison;
  tax: number | null;
  delta: number | null;
  isBest: boolean;
  years: string;
};

export type RecommendedView = {
  title: string;
  caption: string;
  tax: number | null;
  net: number | null;
};

export type NextBestView = {
  caption: string;
  tax: number | null;
  net: number | null;
};

export type YearRowView = {
  year: number;
  cells: string[];
  line: string;
};

export type ResultView = {
  cards: PatternCardView[] | null;
  currentCaption: string;
  recommended: RecommendedView | null;
  nextBest: NextBestView | null;
  simultaneousDelta: number | null;
  amendmentDelta: number | null;
  showTax: boolean;
  taxNotice: string | null;
  disclaimer: string;
  yearHeaders: string[];
  yearRows: YearRowView[];
  amendmentTitle: string;
  amendmentLead: string;
  preFixedTax: number | null;
  preFixedNet: number | null;
  postFixedTax: number | null;
  postFixedNet: number | null;
  patternTitle: string | null;
  patternLead: string | null;
  screenLines: string[];
  regimeLine: string;
  periods: { id: string; text: string }[];
  searchNote: string | null;
  searchBestLine: string | null;
  searchBestTax: number | null;
  searchRows: { caption: string; tax: number | null }[];
};

const SHORT_TENURE_TAX_NOTICE = "勤続5年以下の手当があるため、税額は出していません。";
const DISCLAIMER =
  "退職所得の申告書を提出する前提です。出すのは一時金の税額だけで、年金受取は含みません。試算であり、税務助言ではありません。";
const AMENDMENT_TITLE = "改正前と改正後";
const PATTERN_TITLE = "同時 / 退職金先 / iDeCo先";
const PATTERN_LEAD =
  "この3案の中の最小です。探索全体の最小とは別に出します。差額の基準は、会社の受取年での同時受取です。";
const YEAR_HEADERS = [
  "受取年",
  "収入",
  "勤続",
  "控除（調整前）",
  "控除（調整後）",
  "課税所得",
  "所得税",
  "復興税",
  "住民税",
  "税額",
  "手取り",
];

function amendmentLead(ruleModeLabel: string): string {
  return `同じ入力・同じ受取年です。左は改正前に固定、右は改正後に固定した税額です。主計算は「${ruleModeLabel}」です。`;
}

function signedYen(delta: number): string {
  return `${delta > 0 ? "+" : ""}${formatYen(delta)}`;
}

function buildYearRows(years: SimulationResult["years"]): YearRowView[] {
  return years.map((year) => {
    const cells = [
      String(year.year),
      formatYen(year.incomeYen),
      `${year.serviceYears}年`,
      formatYen(year.statutoryDeductionYen),
      formatYen(year.deductionAfterAdjustmentYen),
      formatYen(year.taxableYen),
      formatYen(year.incomeTaxYen),
      formatYen(year.reconstructionTaxYen),
      formatYen(year.residentTaxYen),
      formatYen(year.totalTaxYen),
      formatYen(year.netYen),
    ];
    return {
      year: year.year,
      cells,
      line: `- ${year.year}年 収入 ${cells[1]} 勤続 ${cells[2]} 控除（調整前） ${cells[3]} 控除（調整後） ${cells[4]} 課税所得 ${cells[5]} 所得税 ${cells[6]} 復興税 ${cells[7]} 住民税 ${cells[8]} 税額 ${cells[9]} 手取り ${cells[10]}`,
    };
  });
}

function receiptCaption(receiptYears: Record<string, number>, benefits: BenefitInput[]): string {
  return Object.entries(receiptYears)
    .map(([id, year]) => {
      const index = benefits.findIndex((item) => item.id === id);
      const benefit = index >= 0 ? benefits[index] : undefined;
      const name = benefit ? KIND_LABELS[benefit.kind] : id;
      const clash =
        benefit !== undefined && benefits.filter((item) => item.kind === benefit.kind).length > 1;
      return `${name}${clash ? ` ${index + 1}` : ""} ${year}年`;
    })
    .join("、");
}

function benefitYearList(benefits: BenefitInput[]): string {
  return benefits
    .map((benefit, index) => {
      const clash = benefits.filter((item) => item.kind === benefit.kind).length > 1;
      return `${KIND_LABELS[benefit.kind]}${clash ? ` ${index + 1}` : ""} ${benefit.receiptYear}年`;
    })
    .join("、");
}

function patternCards(patterns: PatternComparison[]): PatternCardView[] {
  const baselineTax = patterns.find((p) => p.kind === "simultaneous" && !p.omittedReason)?.result
    ?.totalTaxYen;
  const taxes = patterns.flatMap((p) => {
    const tax = p.omittedReason ? null : (p.result?.totalTaxYen ?? null);
    return tax === null ? [] : [tax];
  });
  const bestTax = taxes.length ? Math.min(...taxes) : null;
  return patterns.map((pattern) => {
    const tax = pattern.omittedReason ? null : (pattern.result?.totalTaxYen ?? null);
    const delta = tax !== null && baselineTax != null ? tax - baselineTax : null;
    return {
      pattern,
      tax,
      delta,
      isBest: bestTax !== null && tax === bestTax && !pattern.omittedReason,
      years: benefitYearList(pattern.input.benefits),
    };
  });
}

function autoRegime(year: number): string {
  return year >= defaultRuleset.amendmentEffectiveYear
    ? `${year}年の支払は改正後（${defaultRuleset.amendmentEffectiveYear}年以後）`
    : `${year}年の支払は改正前（${defaultRuleset.amendmentEffectiveYear}年より前）`;
}

function periodLine(benefit: BenefitInput, birth?: YearMonth): string {
  const name = KIND_LABELS[benefit.kind];
  try {
    const intervals = resolveBenefitIntervals(benefit, birth);
    return `${name} ${benefit.receiptYear}年: ${formatMonthIntervals(intervals)}`;
  } catch {
    return `${name} ${benefit.receiptYear}年`;
  }
}

export function buildResultView(args: {
  result: SimulationResult;
  patterns: PatternComparison[] | null;
  search: SearchResult | null;
  benefits: BenefitInput[];
  birth?: YearMonth;
  ruleMode: RuleMode;
  preAmendment: SimulationResult;
  postAmendment: SimulationResult;
}): ResultView {
  const { result, patterns, search, benefits, birth, ruleMode, preAmendment, postAmendment } = args;
  const cards = patterns ? patternCards(patterns) : null;
  const currentCaption = benefitYearList(benefits);
  const bestCard = cards?.find((card) => card.isBest && card.tax !== null);
  const recommended = search?.best
    ? {
        title: "推奨案（探索全体の最小）",
        caption: receiptCaption(search.best.receiptYears, benefits),
        tax: search.best.result.totalTaxYen,
        net: search.best.result.totalNetYen,
      }
    : bestCard
      ? {
          title: "推奨案（3案の中で最小）",
          caption: benefitYearList(bestCard.pattern.input.benefits),
          tax: bestCard.tax,
          net: bestCard.pattern.result?.totalNetYen ?? null,
        }
      : null;
  const nextBest =
    search && search.hits.length > 1
      ? {
          caption: receiptCaption(search.hits[1].receiptYears, benefits),
          tax: search.hits[1].result.totalTaxYen,
          net: search.hits[1].result.totalNetYen,
        }
      : null;
  const simultaneous = patterns?.find((pattern) => pattern.kind === "simultaneous" && !pattern.omittedReason);
  const comparedTax = recommended?.tax ?? result.totalTaxYen;
  const simultaneousDelta =
    comparedTax !== null && simultaneous?.result?.totalTaxYen != null
      ? comparedTax - simultaneous.result.totalTaxYen
      : null;
  const amendmentDelta =
    preAmendment.totalTaxYen !== null && postAmendment.totalTaxYen !== null
      ? postAmendment.totalTaxYen - preAmendment.totalTaxYen
      : null;
  const blocked = result.warnings.find((warning) => warning.code === "receipt_ineligible");
  const showTax = result.totalTaxYen !== null;
  const taxNotice = blocked ? blocked.message : showTax ? null : SHORT_TENURE_TAX_NOTICE;
  const yearRows = buildYearRows(result.years);
  const ruleModeLabel = RULE_MODE_LABELS[ruleMode];
  const lead = amendmentLead(ruleModeLabel);
  const patternTitle = cards ? PATTERN_TITLE : null;
  const patternLead = cards ? PATTERN_LEAD : null;
  const preFixedTax = preAmendment.totalTaxYen;
  const preFixedNet = preAmendment.totalNetYen;
  const postFixedTax = postAmendment.totalTaxYen;
  const postFixedNet = postAmendment.totalNetYen;
  const receiptYears = [...new Set(benefits.map((benefit) => benefit.receiptYear))].sort((a, b) => a - b);
  const searchBestLine = search?.best
    ? `探索全体の最小: ${receiptCaption(search.best.receiptYears, benefits)}`
    : null;
  const searchBestTax = search?.best?.result.totalTaxYen ?? null;
  const searchRows = (search?.hits.slice(0, 8) ?? []).map((hit) => ({
    caption: receiptCaption(hit.receiptYears, benefits),
    tax: hit.result.totalTaxYen,
  }));
  const recommendedLines = recommended
    ? [
        `${recommended.title}: ${recommended.caption}`,
        `推奨の税額: ${formatYen(recommended.tax)}`,
        `推奨の手取り: ${formatYen(recommended.net)}`,
      ]
    : [];
  const nextBestLines = nextBest
    ? [`次善策: ${nextBest.caption} 税額 ${formatYen(nextBest.tax)} 手取り ${formatYen(nextBest.net)}`]
    : [];
  const simultaneousLines =
    simultaneousDelta !== null && simultaneousDelta !== 0
      ? [`同時受取との差額 ${signedYen(simultaneousDelta)}`]
      : [];
  const amendmentAmountLines = [
    `改正前に固定 税額 ${formatYen(preFixedTax)} 手取り ${formatYen(preFixedNet)}`,
    `改正後に固定 税額 ${formatYen(postFixedTax)} 手取り ${formatYen(postFixedNet)}`,
    `差額（改正後 − 改正前） ${amendmentDelta === null ? "—" : signedYen(amendmentDelta)}`,
  ];
  const patternTaxLines = (cards ?? []).map((card) => {
    const taxText = card.pattern.omittedReason ? "—" : formatYen(card.tax);
    return `- ${card.pattern.label}: ${card.years} 税額 ${taxText}`;
  });
  const searchTaxLines = [
    ...(searchBestLine ? [`${searchBestLine} 税額 ${formatYen(searchBestTax)}`] : []),
    ...searchRows.map((row) => `- ${row.caption} 税額 ${formatYen(row.tax)}`),
  ];
  return {
    cards,
    currentCaption,
    recommended,
    nextBest,
    simultaneousDelta,
    amendmentDelta,
    showTax,
    taxNotice,
    disclaimer: DISCLAIMER,
    yearHeaders: [...YEAR_HEADERS],
    yearRows,
    amendmentTitle: AMENDMENT_TITLE,
    amendmentLead: lead,
    preFixedTax,
    preFixedNet,
    postFixedTax,
    postFixedNet,
    patternTitle,
    patternLead,
    screenLines: [
      ...(taxNotice ? [taxNotice] : []),
      DISCLAIMER,
      ...recommendedLines,
      ...nextBestLines,
      ...simultaneousLines,
      AMENDMENT_TITLE,
      lead,
      ...amendmentAmountLines,
      ...(patternTitle && patternLead ? [patternTitle, patternLead, ...patternTaxLines] : []),
      ...searchTaxLines,
      ...yearRows.map((row) => row.line),
    ],
    regimeLine: receiptYears.map((year) => autoRegime(year)).join("。"),
    periods: benefits.map((benefit) => ({ id: benefit.id, text: periodLine(benefit, birth) })),
    searchNote: search
      ? search.truncated
        ? `組合せが ${search.combinationCount} あり、${search.hits.length} 件で打ち切りました。`
        : `${search.combinationCount} 通り。税額が小さい順、同額なら受取が早い順です。`
      : null,
    searchBestLine,
    searchBestTax,
    searchRows,
  };
}
