import { defaultRuleset } from "./ruleset";
import type { TaxRuleset } from "./types";

export function statutoryDeductionYen(
  years: number,
  ruleset: TaxRuleset = defaultRuleset,
): number {
  if (years <= 0) return 0;
  if (years <= ruleset.longServiceThresholdYears) {
    return ruleset.basicDeductionPerYearYen * years;
  }
  return (
    ruleset.longServiceBaseYen +
    ruleset.longServicePerYearYen * (years - ruleset.longServiceThresholdYears)
  );
}

export function applyMinimumDeduction(
  amountYen: number,
  ruleset: TaxRuleset = defaultRuleset,
): number {
  if (amountYen <= 0) return ruleset.minimumDeductionYen;
  return Math.max(amountYen, ruleset.minimumDeductionYen);
}

export function usualDeductionYen(
  years: number,
  disability: boolean,
  ruleset: TaxRuleset = defaultRuleset,
): number {
  const afterMin = applyMinimumDeduction(
    statutoryDeductionYen(years, ruleset),
    ruleset,
  );
  return afterMin + (disability ? ruleset.disabilityAdditionYen : 0);
}

/**
 * 調整後控除。重複側には80万下限も障害加算も掛けない。
 * 減算後に80万下限、そのあと障害 +100万。
 */
export function adjustedDeductionYen(args: {
  serviceYears: number;
  overlapYears: number;
  disability: boolean;
  ruleset?: TaxRuleset;
}): number {
  const ruleset = args.ruleset ?? defaultRuleset;
  const statutory = statutoryDeductionYen(args.serviceYears, ruleset);
  const overlap = statutoryDeductionYen(args.overlapYears, ruleset);
  const afterOverlap = statutory - overlap;
  const afterMin = applyMinimumDeduction(afterOverlap, ruleset);
  return afterMin + (args.disability ? ruleset.disabilityAdditionYen : 0);
}

/** 令70条2項。比較は30条3項（80万下限なし）。 */
export function needsDeemedService(
  incomeYen: number,
  serviceYears: number,
  ruleset: TaxRuleset = defaultRuleset,
): boolean {
  return incomeYen < statutoryDeductionYen(serviceYears, ruleset);
}

export function reverseDeemedYears(
  incomeYen: number,
  ruleset: TaxRuleset = defaultRuleset,
): number {
  if (incomeYen <= ruleset.longServiceBaseYen) {
    return Math.floor(incomeYen / ruleset.basicDeductionPerYearYen);
  }
  return (
    Math.floor(
      (incomeYen - ruleset.longServiceBaseYen) / ruleset.longServicePerYearYen,
    ) + ruleset.longServiceThresholdYears
  );
}
