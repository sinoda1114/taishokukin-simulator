import { defaultRuleset } from "./ruleset";
import { ageInCalendarYear, simulate, yearOfAge } from "./simulate";
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
  if (!benefit.optimizeReceiptYear) return [benefit.receiptYear];
  if (benefit.kind === "dc" && input.birthYearMonth) {
    const years: number[] = [];
    for (let age = ruleset.dcReceiptAgeMin; age <= ruleset.dcReceiptAgeMax; age += 1) {
      years.push(yearOfAge(input.birthYearMonth, age));
    }
    return years;
  }
  if (benefit.kind === "dc") {
    const years: number[] = [];
    for (let delta = -10; delta <= 15; delta += 1) {
      years.push(benefit.receiptYear + delta);
    }
    return [...new Set(years)].sort((a, b) => a - b);
  }
  return [benefit.receiptYear];
}

function cartesian(lists: number[][]): number[][] {
  return lists.reduce<number[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  );
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
  const lists = input.benefits.map((b) => candidateYears(b, input, ruleset));
  const combos = cartesian(lists);
  const truncated = combos.length > SEARCH_COMBINATION_CAP;
  const used = truncated ? combos.slice(0, SEARCH_COMBINATION_CAP) : combos;

  const hits: SearchHit[] = used.map((years) => {
    const receiptYears: Record<string, number> = {};
    const benefits = input.benefits.map((benefit, index) => {
      receiptYears[benefit.id] = years[index];
      return { ...benefit, receiptYear: years[index], optimizeReceiptYear: false };
    });
    const next: SimulationInput = { ...input, benefits };
    return { receiptYears, result: simulate(next, ruleset) };
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
    combinationCount: combos.length,
  };
}

export function dcAgeAtYear(
  input: SimulationInput,
  year: number,
): number | null {
  if (!input.birthYearMonth) return null;
  return ageInCalendarYear(input.birthYearMonth, year);
}
