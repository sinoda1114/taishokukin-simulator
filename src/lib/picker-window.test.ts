import { describe, expect, it } from "vitest";
import { MAX_PICKER_OPTIONS, pickerWindow } from "./picker-window";

describe("pickerWindow", () => {
  it("keeps a small range intact", () => {
    expect(pickerWindow(1, 12, 4)).toEqual({ min: 1, max: 12 });
  });

  it("does not build 1900–2200 at once; windows around the typed year", () => {
    const window = pickerWindow(1900, 2200, 1965);
    expect(window.max - window.min + 1).toBe(MAX_PICKER_OPTIONS);
    expect(window.min).toBeLessThanOrEqual(1965);
    expect(window.max).toBeGreaterThanOrEqual(1965);
    expect(window.min).toBeGreaterThan(1900);
    expect(window.max).toBeLessThan(2200);
  });

  it("centers a year range on the current year when nothing is typed", () => {
    const window = pickerWindow(1900, 2200, null, 2026);
    expect(window.min).toBeLessThanOrEqual(2026);
    expect(window.max).toBeGreaterThanOrEqual(2026);
    expect(window.max - window.min + 1).toBe(MAX_PICKER_OPTIONS);
  });
});
