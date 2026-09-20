import { dcReceiptYears } from "./explain";
import { defaultRuleset } from "./ruleset";
import { ageInCalendarYear, freezeServiceIntervals, simulate } from "./simulate";
import type {
  BenefitInput,
  SearchHit,
  SearchResult,
  SimulationInput,
  TaxRuleset,
} from "./types";

export const SEARCH_COMBINATION_CAP = 400;

function candidateYears(
  benefit: BenefitInput,
  input: SimulationInput,
  ruleset: TaxRuleset,
): number[] {
  if (!benefit.optimizeReceiptYear || benefit.kind !== "dc" || !input.birthYearMonth) {
    return [benefit.receiptYear];
  }
  return dcReceiptYears(input.birthYearMonth.year, ruleset);
}

function productCount(lists: number[][]): number {
  let n = 1;
  for (const list of lists) {
    if (list.length === 0) {
      throw new Error("受取年の候補が空です");
    }
    n *= list.length;
  }
  return n;
}

function cartesian(lists: number[][]): number[][] {
  return lists.reduce<number[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  );
}

function planReceiptYears(
  benefits: BenefitInput[],
  fullLists: number[][],
): {
  lists: number[][];
  variedBenefitIds: string[];
  combinationCount: number;
  truncated: boolean;
} {
  const combinationCount = productCount(fullLists);
  const variable = benefits
    .map((benefit, index) => ({ id: benefit.id, years: fullLists[index] }))
    .filter((entry) => entry.years.length > 1);
  if (combinationCount <= SEARCH_COMBINATION_CAP) {
    return {
      lists: fullLists,
      variedBenefitIds: variable.map((entry) => entry.id),
      combinationCount,
      truncated: false,
    };
  }
  const first = variable[0];
  return {
    lists: first
      ? benefits.map((benefit, index) =>
          benefit.id === first.id ? fullLists[index] : [benefit.receiptYear],
        )
      : fullLists,
    variedBenefitIds: first ? [first.id] : [],
    combinationCount,
    truncated: true,
  };
}

function totalTaxOrInf(hit: SearchHit): number {
  return hit.result.totalTaxYen ?? Number.POSITIVE_INFINITY;
}

function earlierReceipt(hit: SearchHit): number {
  return Math.min(...Object.values(hit.receiptYears));
}

export function searchReceiptYears(
  input: SimulationInput,
  ruleset: TaxRuleset = defaultRuleset,
): SearchResult {
  const frozen = freezeServiceIntervals(input);
  const fullLists = frozen.benefits.map((b) => candidateYears(b, frozen, ruleset));
  const plan = planReceiptYears(frozen.benefits, fullLists);

  const hits: SearchHit[] = cartesian(plan.lists).map((years) => {
    const receiptYears: Record<string, number> = {};
    const benefits = frozen.benefits.map((benefit, i) => {
      receiptYears[benefit.id] = years[i];
      return { ...benefit, receiptYear: years[i], optimizeReceiptYear: false };
    });
    return {
      receiptYears,
      result: simulate({ ...frozen, benefits }, ruleset),
    };
  });

  const feasible = hits.filter((h) => h.result.totalTaxYen !== null);
  feasible.sort((a, b) => {
    const tax = totalTaxOrInf(a) - totalTaxOrInf(b);
    if (tax !== 0) return tax;
    return earlierReceipt(a) - earlierReceipt(b);
  });

  return {
    hits: feasible,
    best: feasible[0] ?? null,
    truncated: plan.truncated,
    combinationCount: plan.combinationCount,
    variedBenefitIds: plan.variedBenefitIds,
  };
}

export function dcAgeAtYear(
  input: SimulationInput,
  year: number,
): number | null {
  if (!input.birthYearMonth) return null;
  return ageInCalendarYear(input.birthYearMonth, year);
}
