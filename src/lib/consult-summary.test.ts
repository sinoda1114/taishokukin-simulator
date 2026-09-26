import { readFileSync } from "node:fs";
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

  it("joins the input lines with the screen sentences and leaves the steps out", () => {
    const screen = resultsScreen();
    const summary = buildConsultSummary(screen);
    const formula = screen.result?.years[0]?.steps[0]?.formula ?? "";
    const yearTax = formatYen(screen.result?.years[0]?.totalTaxYen ?? null);
    expect(formula.length).toBeGreaterThan(0);
    expect(summary).toContain("生年月: 1965年4月");
    expect(summary).toContain(
      "退職所得の申告書を提出する前提です。出すのは一時金の税額だけで、年金受取は含みません。試算であり、税務助言ではありません。",
    );
    expect(summary).toContain("改正前と改正後");
    expect(summary).toContain("改正前に固定");
    expect(summary).toContain("同時 / 退職金先 / iDeCo先");
    expect(summary).toContain("この3案の中の最小です。探索全体の最小とは別に出します。");
    expect(summary).toContain(`税額 ${yearTax}`);
    expect(summary).not.toContain(formula);
    expect(summary).not.toContain("再計算");
  });

  it("keeps the hidden-tax sentence in one place", () => {
    const sentence = "勤続5年以下の手当があるため、税額は出していません。";
    const panel = readFileSync(new URL("../components/ResultPanel.tsx", import.meta.url), "utf8");
    const summarySource = readFileSync(new URL("./consult-summary.ts", import.meta.url), "utf8");
    expect(panel).not.toContain(sentence);
    expect(summarySource).not.toContain(sentence);
    const screen = resultsScreen({
      ...defaultInput,
      benefits: [
        {
          id: "company",
          kind: "company",
          incomeYen: 20_000_000,
          serviceYears: 3,
          receiptYear: 2025,
        },
      ],
    });
    expect(screen.result?.totalTaxYen).toBeNull();
    const summary = buildConsultSummary(screen);
    expect(summary.split(sentence)).toHaveLength(2);
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
