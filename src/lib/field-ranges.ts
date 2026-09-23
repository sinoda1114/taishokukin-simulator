export const FIELD_RANGES = {
  birthYear: { min: 1900, max: 2200 },
  month: { min: 1, max: 12 },
  serviceYears: { min: 1, max: 80 },
  receiptYear: { min: 1980, max: 2200 },
  incomeYen: { min: 0, max: 10_000_000_000 },
  contributionEndAge: { min: 50, max: 75 },
} as const;

export function receiptAgeRange(birthYear: number): { min: number; max: number } {
  return {
    min: Math.max(0, FIELD_RANGES.receiptYear.min - birthYear),
    max: FIELD_RANGES.receiptYear.max - birthYear,
  };
}
