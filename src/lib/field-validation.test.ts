import { describe, expect, it } from "vitest";
import {
  birthYearReceiptError,
  DEFAULT_RECEIPT_AGE,
  FIELD_RANGES,
  defaultReceiptYear,
  receiptAgeRange,
  receiptYearAfterBirthChange,
} from "./field-ranges";
import { benefitKindChoices, isDedicatedDcSlot } from "@/components/benefit-kind-options";
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

  it("starts at 60 and rejects anything younger, including other benefits", () => {
    expect(DEFAULT_RECEIPT_AGE).toBe(60);
    expect(defaultReceiptYear(1965)).toBe(2025);
    expect(defaultReceiptYear(1900)).toBe(1980);
    expect(defaultReceiptYear(2141)).toBeNull();
    expect(birthYearReceiptError(1965)).toBeNull();
    expect(birthYearReceiptError(2141)).toContain("60");
    expect(FIELD_RANGES.birthYear).toEqual({ min: 1900, max: 2200 });
    expect(receiptAgeRange(1977, "company").min).toBe(60);
    expect(receiptAgeRange(1977, "other").min).toBe(60);
    expect(receiptAgeRange(1977, "mutual_aid").min).toBe(60);
    expect(parseReceiptAge("60", 1977, { kind: "company" })).toEqual({ ok: true, value: 60 });
    expect(parseReceiptAge("60", 1977, { kind: "other" })).toEqual({ ok: true, value: 60 });
    expect(parseReceiptAge("59", 1977, { kind: "company" }).ok).toBe(false);
    expect(parseReceiptAge("40", 1977, { kind: "other" }).ok).toBe(false);
    expect(parseReceiptAge("3", 1977, { kind: "other" }).ok).toBe(false);
    expect(parseReceiptAge("3", 1977, { kind: "company" }).ok).toBe(false);
  });

  it("keeps iDeCo on the dedicated slot and off extra rows", () => {
    const company = {
      id: "company",
      kind: "company" as const,
      incomeYen: 1,
      serviceYears: 30,
      receiptYear: 2025,
    };
    const dc = { id: "dc", kind: "dc" as const, incomeYen: 1, serviceYears: 20, receiptYear: 2025 };
    const extra = { id: "extra", kind: "other" as const, incomeYen: 0, serviceYears: 10, receiptYear: 2025 };
    const withCompany = [company, dc, extra];
    expect(isDedicatedDcSlot(dc, withCompany)).toBe(true);
    expect(isDedicatedDcSlot(company, withCompany)).toBe(false);
    expect(isDedicatedDcSlot(extra, withCompany)).toBe(false);
    expect(benefitKindChoices(true).map((option) => option.value)).toContain("dc");
    expect(benefitKindChoices(false).map((option) => option.value)).toEqual([
      "company",
      "mutual_aid",
      "other",
    ]);
    const noCompany = [dc, extra];
    expect(isDedicatedDcSlot(extra, noCompany)).toBe(false);
    expect(benefitKindChoices(isDedicatedDcSlot(extra, noCompany)).some((option) => option.value === "dc")).toBe(
      false,
    );
    expect(benefitKindChoices(isDedicatedDcSlot(dc, noCompany)).some((option) => option.value === "dc")).toBe(true);
  });

  it("keeps a legal DC age when membership months, not service years, set the floor", () => {
    const intervals = [{ start: { year: 2014, month: 1 }, end: { year: 2024, month: 12 } }];
    const withMonths = {
      kind: "dc" as const,
      receiptYear: 2025,
      serviceYears: 9,
      intervals,
    };
    expect(receiptYearAfterBirthChange(withMonths, 1965, 1966)).toBe(2026);
    expect(
      receiptYearAfterBirthChange(
        { kind: "dc", receiptYear: 2025, serviceYears: 9 },
        1965,
        1966,
      ),
    ).toBe(2027);
    expect(
      receiptYearAfterBirthChange(
        { kind: "dc", receiptYear: 2199, serviceYears: 1 },
        2139,
        2140,
      ),
    ).toBe(2199);
  });

  it("hides DC ages under 60 and raises the floor when membership is short", () => {
    expect(parseReceiptAge("59", 1977, { kind: "dc", serviceYears: 20 }).ok).toBe(false);
    expect(parseReceiptAge("60", 1977, { kind: "dc", serviceYears: 20 })).toEqual({ ok: true, value: 60 });
    expect(parseReceiptAge("60", 1977, { kind: "dc", serviceYears: 8 }).ok).toBe(false);
    expect(parseReceiptAge("61", 1977, { kind: "dc", serviceYears: 8 })).toEqual({ ok: true, value: 61 });
    expect(parseReceiptAge("76", 1977, { kind: "dc", serviceYears: 20 }).ok).toBe(false);
    expect(parseReceiptAge("61", 1965, { kind: "dc", membershipMonths: 90 }).ok).toBe(false);
    expect(parseReceiptAge("62", 1965, { kind: "dc", membershipMonths: 90 })).toEqual({ ok: true, value: 62 });
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
