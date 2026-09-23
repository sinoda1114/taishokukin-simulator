import { reconstructSimpleInterval, type YearMonth } from "@/engine";
import { FIELD_RANGES, receiptAgeRange } from "./field-ranges";

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

export function parseCountedInt(
  raw: string,
  opts: { label: string; min: number; max: number; allowComma?: boolean },
): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: `${opts.label}を入れてください` };
  const normalized = opts.allowComma ? trimmed.replaceAll(",", "") : trimmed;
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, error: `${opts.label}は数字で入れてください` };
  }
  const value = Number(normalized);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, error: `${opts.label}は数字で入れてください` };
  }
  if (value < opts.min || value > opts.max) {
    return {
      ok: false,
      error: `${opts.label}は${opts.min}〜${opts.max}の範囲で入れてください`,
    };
  }
  return { ok: true, value };
}

export function parseBirthYear(raw: string): ParseResult {
  return parseCountedInt(raw, { label: "生年", ...FIELD_RANGES.birthYear });
}

export function parseMonth(raw: string, label = "月"): ParseResult {
  return parseCountedInt(raw, { label, ...FIELD_RANGES.month });
}

export function parseServiceYears(raw: string, label = "勤続年数"): ParseResult {
  return parseCountedInt(raw, { label, ...FIELD_RANGES.serviceYears });
}

export function parseIncomeYen(raw: string): ParseResult {
  return parseCountedInt(raw, { label: "見込み受取額", allowComma: true, ...FIELD_RANGES.incomeYen });
}

export function parseReceiptAge(raw: string, birthYear: number | null): ParseResult {
  if (birthYear === null) {
    return { ok: false, error: "生年月を先に入れてください" };
  }
  const range = receiptAgeRange(birthYear);
  return parseCountedInt(raw, { label: "受取年齢", min: range.min, max: range.max });
}

export function parseContributionEndAge(raw: string): ParseResult {
  return parseCountedInt(raw, { label: "拠出終了年齢", ...FIELD_RANGES.contributionEndAge });
}

export function intervalOrderError(start: YearMonth, end: YearMonth): string | null {
  if (start.year > end.year || (start.year === end.year && start.month > end.month)) {
    return "終了が開始より前です";
  }
  return null;
}

export function serviceConflictsWithReceipt(
  serviceYears: number,
  receiptYear: number,
  birth?: YearMonth,
): string | null {
  let interval;
  try {
    interval = reconstructSimpleInterval(serviceYears, receiptYear);
  } catch {
    return "勤続年数と受取年齢が合いません";
  }
  if (interval.start.year < FIELD_RANGES.birthYear.min) {
    return "勤続年数と受取年齢が合いません";
  }
  if (birth) {
    const startBeforeBirth =
      interval.start.year < birth.year ||
      (interval.start.year === birth.year && interval.start.month < birth.month);
    if (startBeforeBirth) return "勤続の開始が生年月より前になります";
  }
  return null;
}

export function receiptYearFromAge(birthYear: number, age: number): number {
  return birthYear + age;
}
