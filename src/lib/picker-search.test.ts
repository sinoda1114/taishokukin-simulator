import { describe, expect, it } from "vitest";
import { digitsFromPickerSearch, prefixCenter } from "./picker-search";

describe("digitsFromPickerSearch", () => {
  it("strips the selected label so appended digits remain", () => {
    expect(digitsFromPickerSearch("1965年2010", "1965年")).toBe("2010");
    expect(digitsFromPickerSearch("1965年", "1965年")).toBe("");
    expect(digitsFromPickerSearch("2010", "1965年")).toBe("2010");
    expect(digitsFromPickerSearch("4月1", "4月")).toBe("1");
  });
});

describe("prefixCenter", () => {
  it("uses an in-range number as the center", () => {
    expect(prefixCenter("1965", 1900, 2200, 2000)).toBe(1965);
    expect(prefixCenter("20", 1, 80, 30)).toBe(20);
  });

  it("moves a year window to the first prefix match, not the range min", () => {
    expect(prefixCenter("20", 1900, 2200, 1965)).toBe(2000);
    expect(prefixCenter("201", 1900, 2200, 1965)).toBe(2010);
    expect(prefixCenter("200", 1900, 2200, 1965)).toBe(2000);
    expect(prefixCenter("192", 1900, 2200, 1965)).toBe(1920);
  });

  it("keeps the fallback when no value in range starts with the digits", () => {
    expect(prefixCenter("3", 1900, 2200, 1965)).toBe(1965);
  });
});
