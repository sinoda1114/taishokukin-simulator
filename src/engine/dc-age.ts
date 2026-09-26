import { serviceYearsFromMonths, totalMonths } from "./months";
import type { BenefitInput, TaxRuleset } from "./types";

type DcAgeRules = Pick<TaxRuleset, "dcReceiptAgeMin" | "dcReceiptAgeMax">;

/** 会社退職金を含めて、退職しうる年齢の下限。 */
export const EARLIEST_RETIREMENT_AGE = 20;

/**
 * 通算加入者等期間（月）で受給開始年齢を決める。
 * 区切りは 24 / 48 / 72 / 96 / 120 か月。端数月は切り上げない。
 */
export function dcMinimumReceiptAgeFromMonths(months: number, ruleset: DcAgeRules): number {
  const floor = ruleset.dcReceiptAgeMin;
  let raised = floor;
  if (months < 24) raised = 65;
  else if (months < 48) raised = 64;
  else if (months < 72) raised = 63;
  else if (months < 96) raised = 62;
  else if (months < 120) raised = 61;
  return Math.min(ruleset.dcReceiptAgeMax, Math.max(floor, raised));
}

/** 整数年の加入期間。1年は 12 か月として月数の区切りに渡す。 */
export function dcMinimumReceiptAge(serviceYears: number, ruleset: DcAgeRules): number {
  return dcMinimumReceiptAgeFromMonths(serviceYears * 12, ruleset);
}

/** 控除の勤続年数。端数月は切り上げる。受給開始年齢には使わない。 */
export function membershipYears(benefit: BenefitInput): number {
  if (benefit.intervals && benefit.intervals.length > 0) {
    return serviceYearsFromMonths(totalMonths(benefit.intervals));
  }
  return benefit.serviceYears ?? 10;
}
