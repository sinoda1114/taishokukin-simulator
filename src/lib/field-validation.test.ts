import { describe, expect, it } from "vitest";
import {
  intervalOrderError,
  parseCountedInt,
  parseReceiptAge,
  receiptYearFromAge,
  serviceConflictsWithReceipt,
} from "./field-validation";

describe("parseCountedInt", () => {
  it("rejects empty, non-numeric, and out of range", () => {
    expect(parseCountedInt("", { label: "生年", min: 1900, max: 2200 }).ok).toBe(false);
    expect(parseCountedInt("abc", { label: "生年", min: 1900, max: 2200 })).toEqual({
      ok: false,
      error: "生年は数字で入れてください",
    });
    expect(parseCountedInt("12.5", { label: "勤続年数", min: 1, max: 80 })).toEqual({
      ok: false,
      error: "勤続年数は数字で入れてください",
    });
    expect(parseCountedInt("1899", { label: "生年", min: 1900, max: 2200 })).toEqual({
      ok: false,
      error: "生年は1900〜2200の範囲で入れてください",
    });
  });

  it("accepts grouped yen", () => {
    expect(parseCountedInt("20,000,000", { label: "見込み受取額", min: 0, max: 10_000_000_000, allowComma: true })).toEqual({
      ok: true,
      value: 20_000_000,
    });
  });
});

describe("receipt age", () => {
  it("needs birth before a year can be shown", () => {
    expect(parseReceiptAge("65", null)).toEqual({
      ok: false,
      error: "生年月を先に入れてください",
    });
  });

  it("uses the calendar year the birthday falls in", () => {
    expect(receiptYearFromAge(1965, 65)).toBe(2030);
    expect(parseReceiptAge("65", 1965)).toEqual({ ok: true, value: 65 });
  });

  it("rejects an age whose year is outside the receipt range", () => {
    expect(parseReceiptAge("10", 1965).ok).toBe(false);
  });

  it("keeps company retirement under 60 and rejects age 3", () => {
    expect(parseReceiptAge("45", 1977, { kind: "company" })).toEqual({ ok: true, value: 45 });
    expect(parseReceiptAge("20", 1977, { kind: "company" })).toEqual({ ok: true, value: 20 });
    expect(parseReceiptAge("3", 1977, { kind: "company" }).ok).toBe(false);
    expect(parseReceiptAge("19", 1977, { kind: "company" }).ok).toBe(false);
  });

  it("hides DC ages under 60 and raises the floor when membership is short", () => {
    expect(parseReceiptAge("59", 1977, { kind: "dc", serviceYears: 20 }).ok).toBe(false);
    expect(parseReceiptAge("60", 1977, { kind: "dc", serviceYears: 20 })).toEqual({ ok: true, value: 60 });
    expect(parseReceiptAge("60", 1977, { kind: "dc", serviceYears: 8 }).ok).toBe(false);
    expect(parseReceiptAge("61", 1977, { kind: "dc", serviceYears: 8 })).toEqual({ ok: true, value: 61 });
    expect(parseReceiptAge("76", 1977, { kind: "dc", serviceYears: 20 }).ok).toBe(false);
  });
});

describe("service vs receipt", () => {
  it("flags a tenure that starts before birth", () => {
    expect(serviceConflictsWithReceipt(80, 2030, { year: 1965, month: 4 })).toBe(
      "勤続の開始が生年月より前になります",
    );
  });

  it("allows the sample 30 years ending at 65", () => {
    expect(serviceConflictsWithReceipt(30, 2030, { year: 1965, month: 4 })).toBeNull();
  });
});

describe("interval order", () => {
  it("flags a reversed period", () => {
    expect(
      intervalOrderError({ year: 2030, month: 4 }, { year: 2029, month: 12 }),
    ).toBe("終了が開始より前です");
  });
});
