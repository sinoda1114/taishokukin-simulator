import {
  dcMinimumReceiptAgeFromMonths,
  defaultRuleset,
  totalMonths,
  type BenefitInput,
  type BenefitKind,
} from "@/engine";

/** 画面で選べる受取年齢の下限。初期値も同じ。税の計算式とは別。 */
export const RECEIPT_AGE_MIN = 60;
export const DEFAULT_RECEIPT_AGE = RECEIPT_AGE_MIN;
export const CONTRIBUTION_END_AGE_CAP = 65;

/** 生年として選べる年齢。受取年齢の下限とは別。 */
const BIRTH_YEAR_MIN_AGE = 18;
const BIRTH_YEAR_MAX_AGE = 110;

export const FIELD_RANGES = {
  /** 保存値と勤続区間の暦年。生年ピッカーは birthYearBounds を使う。 */
  birthYear: { min: 1900, max: 2200 },
  month: { min: 1, max: 12 },
  serviceYears: { min: 1, max: 80 },
  receiptYear: { min: 1980, max: 2200 },
  incomeYen: { min: 0, max: 10_000_000_000 },
  contributionEndAge: { min: 50, max: CONTRIBUTION_END_AGE_CAP },
} as const;

/** 選べる生年。今年より後は出さない。受取年の範囲とは別。 */
export function birthYearBounds(calendarYear: number): { min: number; max: number } {
  return {
    min: calendarYear - BIRTH_YEAR_MAX_AGE,
    max: calendarYear - BIRTH_YEAR_MIN_AGE,
  };
}

export const CONTRIBUTION_END_NOTE =
  "拠出終了は受取年齢以前です。選べる上限は65歳です。2026年12月の70歳未満への拡大は、この試算の選択肢には入れていません。";

export function generalReceiptAgeRange(birthYear: number): { min: number; max: number } {
  const minFromYear = FIELD_RANGES.receiptYear.min - birthYear;
  const maxFromYear = FIELD_RANGES.receiptYear.max - birthYear;
  return {
    min: Math.max(RECEIPT_AGE_MIN, minFromYear),
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

export function birthYearReceiptError(birthYear: number): string | null {
  const range = generalReceiptAgeRange(birthYear);
  if (range.min <= range.max) return null;
  return `この生年では受取年齢${RECEIPT_AGE_MIN}歳の受取年が${FIELD_RANGES.receiptYear.max}年を超えます`;
}

export function clampReceiptAge(range: { min: number; max: number }, age: number): number | null {
  if (range.min > range.max) return null;
  return Math.min(range.max, Math.max(range.min, age));
}

export function receiptYearForAge(
  birthYear: number,
  age: number,
  range: { min: number; max: number },
): number | null {
  const clamped = clampReceiptAge(range, age);
  return clamped === null ? null : birthYear + clamped;
}

export function defaultReceiptYear(birthYear: number): number | null {
  return receiptYearForAge(birthYear, DEFAULT_RECEIPT_AGE, generalReceiptAgeRange(birthYear));
}

export function receiptYearAfterBirthChange(
  benefit: Pick<BenefitInput, "kind" | "receiptYear" | "serviceYears" | "intervals">,
  previousBirthYear: number,
  nextBirthYear: number,
): number {
  const months =
    benefit.intervals && benefit.intervals.length > 0 ? totalMonths(benefit.intervals) : undefined;
  return (
    receiptYearForAge(
      nextBirthYear,
      benefit.receiptYear - previousBirthYear,
      receiptAgeRange(nextBirthYear, benefit.kind, benefit.serviceYears ?? 10, months),
    ) ?? benefit.receiptYear
  );
}

/** 生年がまだ無い手当は、サンプルの生年と初期受取年齢から受取年を出す。 */
export function receiptYearWithoutBirth(sampleBirthYear: number): number | null {
  return defaultReceiptYear(sampleBirthYear);
}

export function contributionEndBounds(receiptAge: number | null): { min: number; max: number } {
  const min = FIELD_RANGES.contributionEndAge.min;
  const cap = FIELD_RANGES.contributionEndAge.max;
  if (receiptAge === null) return { min, max: cap };
  return { min, max: Math.min(cap, receiptAge) };
}
