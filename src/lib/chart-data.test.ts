import { describe, expect, it } from "vitest";
import type { SearchHit } from "@/engine";
import { chartScale, searchLinePoints, valleyYears } from "./chart-data";

function hit(dcYear: number, tax: number): SearchHit {
  return {
    receiptYears: { company: 2030, dc: dcYear },
    result: { totalTaxYen: tax } as SearchHit["result"],
  };
}

describe("searchLinePoints", () => {
  it("plots the varying DC year against the lowest tax at that year", () => {
    const { axisLabel, points } = searchLinePoints(
      [hit(2031, 1_500_000), hit(2032, 1_200_000), hit(2031, 1_800_000), hit(2033, 1_200_000)],
      [
        { id: "company", kind: "company", incomeYen: 0, receiptYear: 2030, serviceYears: 30 },
        { id: "dc", kind: "dc", incomeYen: 0, receiptYear: 2030, serviceYears: 20 },
      ],
    );
    expect(axisLabel).toContain("iDeCo");
    expect(points).toEqual([
      { year: 2031, taxYen: 1_500_000 },
      { year: 2032, taxYen: 1_200_000 },
      { year: 2033, taxYen: 1_200_000 },
    ]);
    expect(valleyYears(points)).toEqual([2032, 2033]);
  });

  it("plots the benefit marked for search even when another year varies more", () => {
    const hits: SearchHit[] = [
      {
        receiptYears: { company: 2030, dc: 2031 },
        result: { totalTaxYen: 2_000_000 } as SearchHit["result"],
      },
      {
        receiptYears: { company: 2031, dc: 2031 },
        result: { totalTaxYen: 1_000_000 } as SearchHit["result"],
      },
    ];
    const { axisLabel, points } = searchLinePoints(hits, [
      { id: "company", kind: "company", incomeYen: 0, receiptYear: 2030, serviceYears: 30 },
      {
        id: "dc",
        kind: "dc",
        incomeYen: 0,
        receiptYear: 2031,
        serviceYears: 20,
        optimizeReceiptYear: true,
      },
    ]);
    expect(axisLabel).toContain("iDeCo");
    expect(points).toEqual([{ year: 2031, taxYen: 1_000_000 }]);
  });
});

describe("chartScale", () => {
  it("puts a single year or tax in the middle instead of dividing by zero", () => {
    expect(chartScale(2030, 2030, 2030, 52, 256)).toBe(52 + 128);
    expect(chartScale(1_200_000, 1_200_000, 1_200_000, 0, 116)).toBe(58);
    expect(Number.isFinite(chartScale(2030, 2030, 2030, 52, 256))).toBe(true);
  });

  it("maps the ends of a range onto the drawable span", () => {
    expect(chartScale(2025, 2025, 2040, 52, 256)).toBe(52);
    expect(chartScale(2040, 2025, 2040, 52, 256)).toBe(308);
  });
});
