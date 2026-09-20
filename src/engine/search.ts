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
  return lists.reduce((n, list) => n * Math.max(list.length, 1), 1);
}

function collapseToFirstRange(
  lists: number[][],
  receiptYears: number[],
): number[][] {
  const first = lists.findIndex((list) => list.length > 1);
  if (first < 0) return lists;
  return lists.map((list, index) =>
    index === first ? list : [receiptYears[index]],
  );
}

function enumerateCapped(lists: number[][], cap: number): number[][] {
  const out: number[][] = [];
  const index = lists.map(() => 0);
  while (out.length < cap) {
    out.push(lists.map((list, i) => list[index[i]]));
    let pos = lists.length - 1;
    while (pos >= 0) {
      index[pos] += 1;
      if (index[pos] < lists[pos].length) break;
      index[pos] = 0;
      pos -= 1;
    }
    if (pos < 0) break;
  }
  return out;
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
  const combinationCount = productCount(fullLists);
  const truncated = combinationCount > SEARCH_COMBINATION_CAP;
  const lists = truncated
    ? collapseToFirstRange(
        fullLists,
        frozen.benefits.map((b) => b.receiptYear),
      )
    : fullLists;
  const combos = enumerateCapped(lists, SEARCH_COMBINATION_CAP);

  const hits: SearchHit[] = combos.map((years) => {
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
    truncated,
    combinationCount,
  };
}

export function dcAgeAtYear(
  input: SimulationInput,
  year: number,
): number | null {
  if (!input.birthYearMonth) return null;
  return ageInCalendarYear(input.birthYearMonth, year);
}
