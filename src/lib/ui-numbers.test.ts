import { describe, expect, it } from "vitest";
import { toInt } from "./ui-numbers";

describe("toInt", () => {
  it("keeps finite numbers and truncates", () => {
    expect(toInt(20.9)).toBe(20);
    expect(toInt(0)).toBe(0);
  });

  it("uses fallback for empty and non-numeric strings", () => {
    expect(toInt("", 1965)).toBe(1965);
    expect(toInt("abc", 1)).toBe(1);
  });
});
