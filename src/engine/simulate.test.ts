import { describe, expect, it } from "vitest";
import { buildThreePatterns } from "./patterns";
import { searchReceiptYears } from "./search";
import { simulate } from "./simulate";
import type { BenefitInput, SimulationInput } from "./types";

const birth = { year: 1965, month: 4 };

function input(
  benefits: BenefitInput[],
  ruleMode: SimulationInput["ruleMode"] = "auto",
): SimulationInput {
  return { schemaVersion: 1, birthYearMonth: birth, ruleMode, benefits };
}

const company30: BenefitInput = {
  id: "company",
  kind: "company",
  incomeYen: 20_000_000,
  intervals: [{ start: { year: 2001, month: 1 }, end: { year: 2030, month: 12 } }],
  receiptYear: 2030,
};

const dc20: BenefitInput = {
  id: "dc",
  kind: "dc",
  incomeYen: 10_000_000,
  intervals: [{ start: { year: 2011, month: 1 }, end: { year: 2030, month: 12 } }],
  receiptYear: 2030,
};

describe("T1-T4 video restatement", () => {
  it("T1 same-year lump is 1,861,869 yen", () => {
    const result = simulate(input([company30, dc20]));
    expect(result.years).toHaveLength(1);
    const year = result.years[0];
    expect(year.taxableYen).toBe(7_500_000);
    expect(year.incomeTaxYen).toBe(1_089_000);
    expect(year.reconstructionTaxYen).toBe(22_869);
    expect(year.residentTaxYen).toBe(750_000);
    expect(year.totalTaxYen).toBe(1_861_869);
    expect(result.totalTaxYen).toBe(1_861_869);
  });

  it("T2 company 2030 then DC 2035 is 1,368,544 yen", () => {
    const result = simulate(
      input([
        company30,
        { ...dc20, receiptYear: 2035 },
      ]),
    );
    expect(result.years[0].totalTaxYen).toBe(405_702);
    expect(result.years[1].deductionAfterAdjustmentYen).toBe(800_000);
    expect(result.years[1].taxableYen).toBe(4_600_000);
    expect(result.years[1].totalTaxYen).toBe(962_842);
    expect(result.totalTaxYen).toBe(1_368_544);
  });

  it("T3 DC 2025 then company 2030 under pre-2026 4-year window is 556,752 yen", () => {
    const result = simulate(
      input(
        [
          { ...dc20, intervals: [{ start: { year: 2006, month: 1 }, end: { year: 2025, month: 12 } }], receiptYear: 2025 },
          company30,
        ],
        "pre_2026",
      ),
    );
    expect(result.years[1].overlapYears).toBe(0);
    expect(result.years[0].totalTaxYen).toBe(151_050);
    expect(result.years[1].totalTaxYen).toBe(405_702);
    expect(result.totalTaxYen).toBe(556_752);
  });

  it("T4 DC 2025 then company 2030 under 2026+ 9-year window is 1,691,872 yen", () => {
    const result = simulate(
      input(
        [
          { ...dc20, intervals: [{ start: { year: 2006, month: 1 }, end: { year: 2025, month: 12 } }], receiptYear: 2025 },
          company30,
        ],
        "post_2026",
      ),
    );
    expect(result.years[1].overlapYears).toBe(20);
    expect(result.years[1].deductionAfterAdjustmentYen).toBe(7_000_000);
    expect(result.years[1].taxableYen).toBe(6_500_000);
    expect(result.years[1].totalTaxYen).toBe(1_540_822);
    expect(result.totalTaxYen).toBe(1_691_872);
  });
});

describe("deemed service and N-benefit cases", () => {
  it("T5: DC 5M / 20 years is deemed 12 years before overlapping the company lump", () => {
    const result = simulate(
      input(
        [
          {
            ...dc20,
            incomeYen: 5_000_000,
            intervals: [{ start: { year: 2006, month: 1 }, end: { year: 2025, month: 12 } }],
            receiptYear: 2025,
          },
          company30,
        ],
        "post_2026",
      ),
    );
    expect(result.years[1].overlapYears).toBe(12);
    expect(result.years[1].notes.some((n) => n.includes("みなし勤続12年"))).toBe(true);
    expect(result.years[1].deductionAfterAdjustmentYen).toBe(10_200_000);
  });

  it("T9: later company has 0 overlap after pre-adjustment deemed service on DC", () => {
    const result = simulate(
      input(
        [
          {
            id: "company1",
            kind: "company",
            incomeYen: 13_000_000,
            intervals: [{ start: { year: 2000, month: 1 }, end: { year: 2022, month: 12 } }],
            receiptYear: 2022,
          },
          {
            id: "dc",
            kind: "dc",
            incomeYen: 5_000_000,
            intervals: [
              { start: { year: 2000, month: 1 }, end: { year: 2022, month: 12 } },
              { start: { year: 2032, month: 1 }, end: { year: 2036, month: 12 } },
            ],
            receiptYear: 2036,
          },
          {
            id: "company2",
            kind: "company",
            incomeYen: 8_000_000,
            intervals: [{ start: { year: 2023, month: 1 }, end: { year: 2042, month: 12 } }],
            receiptYear: 2042,
          },
        ],
        "post_2026",
      ),
    );
    const last = result.years[2];
    expect(last.overlapYears).toBe(0);
    expect(last.taxableYen).toBe(0);
    expect(last.totalTaxYen).toBe(0);
  });

  it("T12: company 8M / 35 years is deemed 20 years and DC tax is 0", () => {
    const result = simulate(
      input([
        {
          id: "company",
          kind: "company",
          incomeYen: 8_000_000,
          intervals: [{ start: { year: 1991, month: 1 }, end: { year: 2025, month: 12 } }],
          receiptYear: 2025,
        },
        {
          id: "dc",
          kind: "dc",
          incomeYen: 10_000_000,
          intervals: [
            { start: { year: 2001, month: 1 }, end: { year: 2025, month: 12 } },
            { start: { year: 2026, month: 1 }, end: { year: 2030, month: 12 } },
          ],
          receiptYear: 2030,
        },
      ]),
    );
    expect(result.years[0].totalTaxYen).toBe(0);
    expect(result.years[1].overlapYears).toBe(10);
    expect(result.years[1].deductionAfterAdjustmentYen).toBe(11_000_000);
    expect(result.years[1].totalTaxYen).toBe(0);
  });

  it("keeps DC and general windows separate even when they share a year", () => {
    const result = simulate(
      input(
        [
          { ...company30, receiptYear: 2028 },
          { ...dc20, receiptYear: 2028 },
          {
            id: "later",
            kind: "company",
            incomeYen: 8_000_000,
            intervals: [{ start: { year: 2029, month: 1 }, end: { year: 2048, month: 12 } }],
            receiptYear: 2032,
          },
        ],
        "post_2026",
      ),
    );
    const later = result.years[1];
    expect(later.notes.some((n) => n.includes("DC") && n.includes("9年内"))).toBe(true);
    expect(later.notes.some((n) => n.includes("一般") && n.includes("4年内"))).toBe(true);
  });
});

describe("short tenure and F2 / search", () => {
  it("does not emit tax for tenure of 5 years or less", () => {
    const result = simulate(
      input([
        {
          id: "short",
          kind: "company",
          incomeYen: 3_000_000,
          serviceYears: 2,
          receiptYear: 2030,
        },
      ]),
    );
    expect(result.years[0].status).toBe("tenure_out_of_scope");
    expect(result.years[0].totalTaxYen).toBeNull();
    expect(result.totalTaxYen).toBeNull();
  });

  it("builds three patterns only for company + DC", () => {
    const patterns = buildThreePatterns(input([company30, dc20]));
    expect(patterns).not.toBeNull();
    expect(patterns?.map((p) => p.kind)).toEqual([
      "simultaneous",
      "company_first",
      "dc_first",
    ]);
    expect(buildThreePatterns(input([company30]))).toBeNull();
  });

  it("searches DC years 60-75 and picks a minimum-tax year", () => {
    const result = searchReceiptYears(
      input([
        company30,
        { ...dc20, optimizeReceiptYear: true },
      ]),
    );
    expect(result.best).not.toBeNull();
    expect(result.combinationCount).toBe(16);
    expect(result.best?.result.totalTaxYen).toBeLessThan(1_861_869);
  });
});
