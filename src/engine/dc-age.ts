import { serviceYearsFromMonths, totalMonths } from "./months";
import type { BenefitInput, TaxRuleset } from "./types";

type DcAgeRules = Pick<TaxRuleset, "dcReceiptAgeMin" | "dcReceiptAgeMax">;

/** 通算加入者等期間が10年未満のとき、受取開始年齢を繰り下げる。 */
export function dcMinimumReceiptAge(serviceYears: number, ruleset: DcAgeRules): number {
  const floor = ruleset.dcReceiptAgeMin;
  let raised = floor;
  if (serviceYears < 2) raised = 65;
  else if (serviceYears < 4) raised = 64;
  else if (serviceYears < 6) raised = 63;
  else if (serviceYears < 8) raised = 62;
  else if (serviceYears < 10) raised = 61;
  return Math.min(ruleset.dcReceiptAgeMax, Math.max(floor, raised));
}

export function membershipYears(benefit: BenefitInput): number {
  if (benefit.intervals && benefit.intervals.length > 0) {
    return serviceYearsFromMonths(totalMonths(benefit.intervals));
  }
  return benefit.serviceYears ?? 10;
}
