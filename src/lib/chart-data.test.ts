import { describe, expect, it } from "vitest";
import type { SearchHit } from "@/engine";
import { chartScale, searchLinePoints, valleyAges } from "./chart-data";

function hit(dcYear: number, tax: number, companyYear = 2030): SearchHit {
  return {
    receiptYears: { company: companyYear, dc: dcYear },
    result: { totalTaxYen: tax } as SearchHit["result"],
  };
}

const benefits = [
  { id: "company", kind: "company" as const, incomeYen: 0, receiptYear: 2030, serviceYears: 30 },
  { id: "dc", kind: "dc" as const, incomeYen: 0, receiptYear: 2030, serviceYears: 20, optimizeReceiptYear: true },
];

describe("searchLinePoints", () => {
  it("plots DC receipt age from 60 to 75, keeping the lowest tax at that age", () => {
    const line = searchLinePoints(
      [hit(2031, 1_500_000), hit(2032, 1_200_000), hit(2031, 1_800_000), hit(2033, 1_200_000)],
      benefits,
      1965,
    );
    expect(line.axisLabel).toContain("受取年齢");
    expect(line.axisMin).toBe(60);
    expect(line.axisMax).toBe(75);
    expect(line.points).toEqual([
      { age: 66, year: 2031, taxYen: 1_500_000, detail: "会社退職金 2030年" },
      { age: 67, year: 2032, taxYen: 1_200_000, detail: "会社退職金 2030年" },
      { age: 68, year: 2033, taxYen: 1_200_000, detail: "会社退職金 2030年" },
    ]);
    expect(line.optimizedPoints).toBeNull();
    expect(valleyAges(line.points)).toEqual([67, 68]);
  });

  it("separates the fixed line from the line that also moves other receipt years", () => {
    const hits: SearchHit[] = [
      hit(2031, 2_000_000, 2030),
      hit(2031, 1_000_000, 2031),
    ];
    const line = searchLinePoints(hits, benefits, 1965);
    expect(line.points).toEqual([
      { age: 66, year: 2031, taxYen: 2_000_000, detail: "会社退職金 2030年" },
    ]);
    expect(line.optimizedPoints).toEqual([
      { age: 66, year: 2031, taxYen: 1_000_000, detail: "会社退職金 2031年" },
    ]);
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
