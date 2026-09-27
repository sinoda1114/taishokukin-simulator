import { dcReceiptYears } from "./explain";
import { defaultRuleset } from "./ruleset";
import {
  ageInCalendarYear,
  benefitAtReceiptYear,
  dcReceiptAgeAllowed,
  simulate,
} from "./simulate";
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
  return dcReceiptYears(input.birthYearMonth.year, ruleset).filter((year) =>
    dcReceiptAgeAllowed(benefit, year, input.birthYearMonth, ruleset),
  );
}

function productCount(lists: number[][]): number {
  let n = 1;
  for (const list of lists) {
    if (list.length === 0) return 0;
    n *= list.length;
  }
  return n;
}

function cartesian(lists: number[][]): number[][] {
  if (lists.some((list) => list.length === 0)) return [];
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
  const truncated = combinationCount > SEARCH_COMBINATION_CAP;
  const firstMulti = fullLists.findIndex((years) => years.length > 1);
  const lists = fullLists.map((years, index) => {
    if (!truncated || years.length <= 1 || index === firstMulti) return years;
    return [benefits[index].receiptYear];
  });
  const variedBenefitIds: string[] = [];
  for (let index = 0; index < lists.length; index += 1) {
    if (lists[index].length > 1) variedBenefitIds.push(benefits[index].id);
  }
  return { lists, variedBenefitIds, combinationCount, truncated };
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
  const fullLists = input.benefits.map((benefit) => candidateYears(benefit, input, ruleset));
  const plan = planReceiptYears(input.benefits, fullLists);

  const hits: SearchHit[] = cartesian(plan.lists).map((years) => {
    const receiptYears: Record<string, number> = {};
    const benefits = input.benefits.map((benefit, index) => {
      const year = years[index];
      receiptYears[benefit.id] = year;
      return benefitAtReceiptYear(benefit, year, input.birthYearMonth);
    });
    return { receiptYears, result: simulate({ ...input, benefits }, ruleset) };
  });

  const feasible = hits.filter((hit) => hit.result.totalTaxYen !== null);
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
