import {
  defaultRuleset,
  formatMonthIntervals,
  resolveBenefitIntervals,
  type BenefitInput,
  type PatternComparison,
  type RuleMode,
  type SearchResult,
  type SimulationResult,
  type SimulationWarning,
  type YearMonth,
} from "@/engine";
import { KIND_LABELS, RULE_MODE_LABELS } from "@/lib/parse-input";

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

export type ResultView = {
  cards: PatternCardView[] | null;
  currentCaption: string;
  recommended: RecommendedView | null;
  nextBest: NextBestView | null;
  simultaneousDelta: number | null;
  amendmentDelta: number | null;
  blocked: SimulationWarning | undefined;
  regimeLine: string;
  periods: { id: string; text: string }[];
  ruleModeLabel: string;
  searchNote: string | null;
  searchBestLine: string | null;
  searchBestTax: number | null;
  searchRows: { caption: string; tax: number | null }[];
};

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
  const receiptYears = [...new Set(benefits.map((benefit) => benefit.receiptYear))].sort((a, b) => a - b);
  return {
    cards,
    currentCaption,
    recommended,
    nextBest,
    simultaneousDelta,
    amendmentDelta,
    blocked,
    regimeLine: receiptYears.map((year) => autoRegime(year)).join("。"),
    periods: benefits.map((benefit) => ({ id: benefit.id, text: periodLine(benefit, birth) })),
    ruleModeLabel: RULE_MODE_LABELS[ruleMode],
    searchNote: search
      ? search.truncated
        ? `組合せが ${search.combinationCount} あり、${search.hits.length} 件で打ち切りました。`
        : `${search.combinationCount} 通り。税額が小さい順、同額なら受取が早い順です。`
      : null,
    searchBestLine: search?.best
      ? `探索全体の最小: ${receiptCaption(search.best.receiptYears, benefits)}`
      : null,
    searchBestTax: search?.best?.result.totalTaxYen ?? null,
    searchRows: (search?.hits.slice(0, 8) ?? []).map((hit) => ({
      caption: receiptCaption(hit.receiptYears, benefits),
      tax: hit.result.totalTaxYen,
    })),
  };
}
