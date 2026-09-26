import { defaultRuleset } from "./ruleset";
import type { TaxRuleset } from "./types";

const BP = 1000;

export function floorToThousand(yen: number): number {
  if (yen <= 0) return 0;
  return Math.floor(yen / 1000) * 1000;
}

export function floorToHundred(yen: number): number {
  if (yen <= 0) return 0;
  return Math.floor(yen / 100) * 100;
}

/** ×1/2 のあと千円未満切捨て。残額が0以下なら0。 */
export function retirementTaxableYen(incomeYen: number, deductionYen: number): number {
  const remainder = incomeYen - deductionYen;
  if (remainder <= 0) return 0;
  return Math.floor(remainder / 2 / 1000) * 1000;
}

function pickBracket(taxableYen: number, ruleset: TaxRuleset) {
  for (const bracket of ruleset.incomeTaxBrackets) {
    if (bracket.upToInclusive === null || taxableYen <= bracket.upToInclusive) {
      return bracket;
    }
  }
  return ruleset.incomeTaxBrackets[ruleset.incomeTaxBrackets.length - 1];
}

export function incomeTaxBracket(
  taxableYen: number,
  ruleset: TaxRuleset = defaultRuleset,
): { rateBp: number; deductionYen: number } {
  const bracket = pickBracket(Math.max(0, taxableYen), ruleset);
  return { rateBp: bracket.rateBp, deductionYen: bracket.deductionYen };
}

export function incomeTaxBaseYen(
  taxableYen: number,
  ruleset: TaxRuleset = defaultRuleset,
): number {
  if (taxableYen <= 0) return 0;
  const bracket = pickBracket(taxableYen, ruleset);
  return (taxableYen * bracket.rateBp) / BP - bracket.deductionYen;
}

export type NationalTaxBreakdown = {
  incomeTaxYen: number;
  reconstructionTaxYen: number;
  nationalTaxYen: number;
};

export function nationalTaxYen(
  taxableYen: number,
  paymentYear: number,
  ruleset: TaxRuleset = defaultRuleset,
): NationalTaxBreakdown {
  const incomeTaxYen = incomeTaxBaseYen(taxableYen, ruleset);
  const applyReconstruction = paymentYear <= ruleset.reconstructionSurtaxUntilYear;
  if (!applyReconstruction) {
    return {
      incomeTaxYen,
      reconstructionTaxYen: 0,
      nationalTaxYen: incomeTaxYen,
    };
  }
  const combined = Math.floor(
    (incomeTaxYen * (BP + ruleset.reconstructionSurtaxRateBp)) / BP,
  );
  return {
    incomeTaxYen,
    reconstructionTaxYen: combined - incomeTaxYen,
    nationalTaxYen: combined,
  };
}

export type ResidentTaxBreakdown = {
  municipalTaxYen: number;
  prefecturalTaxYen: number;
  residentTaxYen: number;
};

export function residentTaxYen(
  taxableYen: number,
  ruleset: TaxRuleset = defaultRuleset,
): ResidentTaxBreakdown {
  if (taxableYen <= 0) {
    return { municipalTaxYen: 0, prefecturalTaxYen: 0, residentTaxYen: 0 };
  }
  const municipalTaxYen = floorToHundred((taxableYen * ruleset.municipalRateBp) / BP);
  const prefecturalTaxYen = floorToHundred(
    (taxableYen * ruleset.prefecturalRateBp) / BP,
  );
  return {
    municipalTaxYen,
    prefecturalTaxYen,
    residentTaxYen: municipalTaxYen + prefecturalTaxYen,
  };
}

export type TaxBreakdown = NationalTaxBreakdown &
  ResidentTaxBreakdown & {
    taxableYen: number;
    totalTaxYen: number;
    netYen: number;
  };

export function taxOnRetirementIncome(args: {
  incomeYen: number;
  deductionYen: number;
  paymentYear: number;
  ruleset?: TaxRuleset;
}): TaxBreakdown {
  const ruleset = args.ruleset ?? defaultRuleset;
  const taxableYen = retirementTaxableYen(args.incomeYen, args.deductionYen);
  const national = nationalTaxYen(taxableYen, args.paymentYear, ruleset);
  const resident = residentTaxYen(taxableYen, ruleset);
  const totalTaxYen = national.nationalTaxYen + resident.residentTaxYen;
  return {
    taxableYen,
    ...national,
    ...resident,
    totalTaxYen,
    netYen: args.incomeYen - totalTaxYen,
  };
}
