import { describe, expect, it } from "vitest";
import { simulate } from "@/engine";
import { defaultInput } from "./default-input";
import { buildResultView } from "./result-view";

describe("buildResultView", () => {
  it("hides the tax figure when there is no retirement benefit", () => {
    const empty = { ...defaultInput, benefits: [] };
    const result = simulate(empty);
    const view = buildResultView({
      result,
      patterns: null,
      search: null,
      benefits: [],
      birth: defaultInput.birthYearMonth,
      ruleMode: "auto",
      preAmendment: simulate({ ...empty, ruleMode: "pre_2026" }),
      postAmendment: simulate({ ...empty, ruleMode: "post_2026" }),
    });
    expect(result.warnings.map((warning) => warning.code)).toContain("no_benefits");
    expect(view.showTax).toBe(false);
    expect(view.taxNotice).toBeNull();
    expect(view.amendmentDelta).toBeNull();
    expect(view.preFixedAmount).toBe("—");
    expect(view.postFixedAmount).toBe("—");
    expect(view.amendmentDeltaLine).toContain("—");
  });
});
