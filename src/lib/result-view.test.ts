import { readFileSync } from "node:fs";
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
    expect(view.showAmendment).toBe(false);
    expect(view.regimeLine).toBe("");
    expect(view.taxNotice).toBeNull();
    expect(view.screenLines.join("\n")).not.toContain("改正前");
    expect(view.screenLines.join("\n")).not.toContain("受取年で自動");
    const panel = readFileSync(new URL("../components/ResultPanel.tsx", import.meta.url), "utf8");
    expect(panel).toContain("{showAmendment ? (");
    expect(panel).toContain("{regimeLine ? (");
  });

  it("heads the notes that sit before the amendment section", () => {
    const result = simulate(defaultInput);
    const view = buildResultView({
      result,
      patterns: null,
      search: null,
      benefits: defaultInput.benefits,
      birth: defaultInput.birthYearMonth,
      ruleMode: "auto",
      preAmendment: simulate({ ...defaultInput, ruleMode: "pre_2026" }),
      postAmendment: simulate({ ...defaultInput, ruleMode: "post_2026" }),
    });
    const lines = view.screenLines;
    expect(view.notesTitle).toBe("前提と注意");
    expect(lines[lines.indexOf(view.disclaimer) - 1]).toBe(view.notesTitle);
    expect(lines.indexOf(view.amendmentTitle)).toBeGreaterThan(lines.indexOf(view.notesTitle));
    const panel = readFileSync(new URL("../components/ResultPanel.tsx", import.meta.url), "utf8");
    expect(panel).toContain("{notesTitle}");
    expect(panel).not.toContain(view.notesTitle);
  });
});
