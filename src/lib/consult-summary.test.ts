import { describe, expect, it } from "vitest";
import { buildThreePatterns, searchReceiptYears, simulate } from "@/engine";
import { defaultInput } from "@/lib/default-input";
import { formatYen } from "@/lib/parse-input";
import { buildConsultSummary, type ConsultScreen } from "@/lib/consult-summary";

function resultsScreen(input = defaultInput): ConsultScreen {
  return {
    phase: "results",
    birthYear: input.birthYearMonth?.year ?? null,
    birthMonth: input.birthYearMonth?.month ?? null,
    ruleMode: input.ruleMode,
    benefits: input.benefits,
    result: simulate(input),
    preAmendment: simulate({ ...input, ruleMode: "pre_2026" }),
    postAmendment: simulate({ ...input, ruleMode: "post_2026" }),
    patterns: buildThreePatterns(input),
    search: searchReceiptYears(input),
  };
}

describe("buildConsultSummary", () => {
  it("keeps the hearing screen free of hidden tax figures", () => {
    const screen = resultsScreen();
    const summary = buildConsultSummary({ ...screen, phase: "hearing" });
    expect(summary).toBe("いまは質問の画面です。結果の税額は出ていません。");
    expect(summary).not.toContain(formatYen(screen.result?.totalTaxYen ?? 0));
  });

  it("quotes the on-screen totals and leaves the calculation steps out", () => {
    const screen = resultsScreen();
    const summary = buildConsultSummary(screen);
    const formula = screen.result?.years[0]?.steps[0]?.formula ?? "";
    expect(formula.length).toBeGreaterThan(0);
    expect(summary).toContain(`合計税額: ${formatYen(screen.result?.totalTaxYen ?? null)}`);
    expect(summary).toContain("改正前に固定");
    expect(summary).toContain("同時 / 退職金先 / iDeCo先");
    expect(summary).not.toContain(formula);
    expect(summary).not.toContain("再計算");
  });

  it("says the tax is absent when the result is not on screen", () => {
    const screen = resultsScreen();
    const summary = buildConsultSummary({
      ...screen,
      result: null,
      preAmendment: null,
      postAmendment: null,
      patterns: null,
      search: null,
    });
    expect(summary).toContain("税額は出ていません");
    expect(summary).toContain("生年月: 1965年4月");
  });
});
