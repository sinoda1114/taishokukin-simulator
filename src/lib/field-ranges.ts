import {
  dcMinimumReceiptAgeFromMonths,
  defaultRuleset,
  EARLIEST_RETIREMENT_AGE,
  type BenefitKind,
} from "@/engine";

export { EARLIEST_RETIREMENT_AGE };
export const DEFAULT_RECEIPT_AGE = 60;
export const CONTRIBUTION_END_AGE_CAP = 65;

export const FIELD_RANGES = {
  birthYear: { min: 1900, max: 2200 },
  month: { min: 1, max: 12 },
  serviceYears: { min: 1, max: 80 },
  receiptYear: { min: 1980, max: 2200 },
  incomeYen: { min: 0, max: 10_000_000_000 },
  contributionEndAge: { min: 50, max: CONTRIBUTION_END_AGE_CAP },
} as const;

export const CONTRIBUTION_END_NOTE =
  "拠出終了は受取年齢以前です。選べる上限は65歳です。2026年12月の70歳未満への拡大は、この試算の選択肢には入れていません。";

export function generalReceiptAgeRange(birthYear: number): { min: number; max: number } {
  const minFromYear = FIELD_RANGES.receiptYear.min - birthYear;
  const maxFromYear = FIELD_RANGES.receiptYear.max - birthYear;
  return {
    min: Math.max(EARLIEST_RETIREMENT_AGE, minFromYear),
    max: maxFromYear,
  };
}

export function receiptAgeRange(
  birthYear: number,
  kind: BenefitKind = "company",
  serviceYears = 10,
  membershipMonths?: number,
): { min: number; max: number } {
  const general = generalReceiptAgeRange(birthYear);
  if (kind !== "dc") return general;
  const months = membershipMonths ?? serviceYears * 12;
  const minAge = dcMinimumReceiptAgeFromMonths(months, defaultRuleset);
  return {
    min: Math.max(general.min, minAge),
    max: Math.min(general.max, defaultRuleset.dcReceiptAgeMax),
  };
}

export function contributionEndBounds(receiptAge: number | null): { min: number; max: number } {
  const min = FIELD_RANGES.contributionEndAge.min;
  const cap = FIELD_RANGES.contributionEndAge.max;
  if (receiptAge === null) return { min, max: cap };
  return { min, max: Math.min(cap, receiptAge) };
}
