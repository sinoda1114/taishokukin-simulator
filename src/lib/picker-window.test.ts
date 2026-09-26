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

  it("keeps retirement ages in view when the legal min is above 20", () => {
    const window = pickerWindow(21, 241, 65);
    expect(window.min).toBeLessThanOrEqual(60);
    expect(window.max).toBeGreaterThanOrEqual(75);
  });

  it("opens with 60 as the first age when the list is aligned to the start", () => {
    const window = pickerWindow(20, 235, 60, "start");
    expect(window.min).toBe(60);
    expect(window.max - window.min + 1).toBe(MAX_PICKER_OPTIONS);
  });
});
