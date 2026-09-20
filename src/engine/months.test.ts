import { describe, expect, it } from "vitest";
import {
  overlapYearsFromMonths,
  reconstructSimpleInterval,
  serviceYearsFromMonths,
  totalMonths,
} from "./months";

describe("month intervals", () => {
  it("counts inclusive months for a full year April to March", () => {
    const months = totalMonths([
      { start: { year: 2017, month: 4 }, end: { year: 2026, month: 3 } },
    ]);
    expect(months).toBe(108);
    expect(serviceYearsFromMonths(months)).toBe(9);
  });

  it("T6: 20 years 3 months raises service years to 21 and floors overlap to 20", () => {
    const months = totalMonths([
        { start: { year: 2006, month: 10 }, end: { year: 2026, month: 12 } },
    ]);
    expect(months).toBe(243);
    expect(serviceYearsFromMonths(months)).toBe(21);
    expect(overlapYearsFromMonths(months)).toBe(20);
  });

  it("reconstructs simple input as Jan of (year-N+1) through Dec of receipt year", () => {
    const interval = reconstructSimpleInterval(30, 2030);
    expect(interval).toEqual({
      start: { year: 2001, month: 1 },
      end: { year: 2030, month: 12 },
    });
    expect(totalMonths([interval])).toBe(360);
    expect(serviceYearsFromMonths(360)).toBe(30);
  });
});
