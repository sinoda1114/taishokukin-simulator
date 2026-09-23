import { describe, expect, it } from "vitest";
import type { SearchHit } from "@/engine";
import { searchLinePoints, valleyYears } from "./chart-data";

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
});
