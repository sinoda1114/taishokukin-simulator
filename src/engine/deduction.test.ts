import { describe, expect, it } from "vitest";
import {
  adjustedDeductionYen,
  reverseDeemedYears,
  statutoryDeductionYen,
} from "./deduction";

describe("retirement income deduction", () => {
  it("uses 40万 × years up to 20, then 800万 + 70万 × excess", () => {
    expect(statutoryDeductionYen(20)).toBe(8_000_000);
    expect(statutoryDeductionYen(21)).toBe(8_700_000);
    expect(statutoryDeductionYen(30)).toBe(15_000_000);
    expect(statutoryDeductionYen(33)).toBe(17_100_000);
    expect(statutoryDeductionYen(35)).toBe(18_500_000);
  });

  it("does not apply the 80万 floor to overlap-side deduction", () => {
    expect(statutoryDeductionYen(1)).toBe(400_000);
    expect(adjustedDeductionYen({ serviceYears: 20, overlapYears: 1, disability: false })).toBe(
      7_600_000,
    );
  });

  it("T10: 33 years minus 15-year overlap is 1110万, not (33-15) years of deduction", () => {
    const correct = adjustedDeductionYen({
      serviceYears: 33,
      overlapYears: 15,
      disability: false,
    });
    expect(correct).toBe(11_100_000);
    expect(statutoryDeductionYen(18)).toBe(7_200_000);
    expect(correct).not.toBe(statutoryDeductionYen(18));
  });

  it("reverses deemed years at 800万, not 80万", () => {
    expect(reverseDeemedYears(5_000_000)).toBe(12);
    expect(reverseDeemedYears(8_000_000)).toBe(20);
    expect(reverseDeemedYears(8_690_000)).toBe(20);
    expect(reverseDeemedYears(15_000_000)).toBe(30);
    expect(reverseDeemedYears(390_000)).toBe(0);
    expect(reverseDeemedYears(400_000)).toBe(1);
  });
});
