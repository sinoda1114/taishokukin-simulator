import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildThreePatterns, searchReceiptYears, simulate } from "@/engine";
import { defaultInput } from "@/lib/default-input";
import { formatYen } from "@/lib/parse-input";
import { buildConsultSummary, type ConsultScreen } from "@/lib/consult-summary";
import { buildResultView } from "@/lib/result-view";

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

  it("quotes the comparison taxes the screen draws from the result view", () => {
    const screen = resultsScreen();
    const summary = buildConsultSummary(screen);
    const view = buildResultView({
      result: screen.result!,
      patterns: screen.patterns,
      search: screen.search,
      benefits: screen.benefits,
      birth:
        screen.birthYear !== null && screen.birthMonth !== null
          ? { year: screen.birthYear, month: screen.birthMonth }
          : undefined,
      ruleMode: screen.ruleMode,
      preAmendment: screen.preAmendment!,
      postAmendment: screen.postAmendment!,
    });
    const panel = readFileSync(new URL("../components/ResultPanel.tsx", import.meta.url), "utf8");
    expect(panel).not.toContain('> 0 ? "+"');
    expect(panel).not.toContain("推奨の税額");
    expect(panel).not.toContain("同時との差");
    expect(view.recommended).not.toBeNull();
    expect(view.recommended?.taxLine.startsWith("税額 ")).toBe(true);
    expect(view.recommended?.netLine.startsWith("手取り ")).toBe(true);
    expect(summary).toContain(view.recommended?.taxLine);
    expect(summary).toContain(view.recommended?.netLine);
    expect(summary).not.toContain("推奨の税額");
    expect(view.nextBest).not.toBeNull();
    expect(view.nextBest?.line).toContain("／ 税額 ");
    expect(view.nextBest?.line).toContain("／ 手取り ");
    expect(summary).toContain(view.nextBest?.line);
    expect(view.simultaneousLine).not.toBeNull();
    expect(summary).toContain(view.simultaneousLine);
    expect(summary).toContain(view.preFixedLabel);
    expect(summary).toContain(view.preFixedAmount);
    expect(summary).toContain(view.preFixedNetLine);
    expect(summary).toContain(view.postFixedAmount);
    expect(summary).toContain(view.postFixedNetLine);
    expect(summary).toContain(view.amendmentDeltaLine);
    expect(summary).not.toContain("改正前に固定 税額");
    expect(view.cards).toHaveLength(3);
    expect(view.cards?.some((card) => card.deltaLine !== null)).toBe(true);
    for (const card of view.cards ?? []) {
      expect(summary).toContain(card.line);
      if (card.deltaLine) expect(card.line).toContain(card.deltaLine);
      if (card.omittedLine) expect(card.line).toContain(card.omittedLine);
    }
    expect(view.searchBestText).not.toBeNull();
    expect(view.searchBestText).toContain("／");
    expect(summary).toContain(view.searchBestText);
    expect(view.searchRows.length).toBeGreaterThan(0);
    for (const row of view.searchRows) {
      expect(summary).toContain(row.line);
      expect(row.line).toContain(row.taxText);
    }
    const formula = screen.result?.years[0]?.steps[0]?.formula ?? "";
    expect(formula.length).toBeGreaterThan(0);
    expect(summary).not.toContain(formula);
  });

  it("includes an omitted pattern reason in the same line as its tax", () => {
    const screen = resultsScreen({
      ...defaultInput,
      benefits: [
        { ...defaultInput.benefits[0]!, optimizeReceiptYear: false },
        { ...defaultInput.benefits[1]!, receiptYear: 2020, optimizeReceiptYear: false },
      ],
    });
    const summary = buildConsultSummary(screen);
    const view = buildResultView({
      result: screen.result!,
      patterns: screen.patterns,
      search: screen.search,
      benefits: screen.benefits,
      birth: { year: 1965, month: 4 },
      ruleMode: screen.ruleMode,
      preAmendment: screen.preAmendment!,
      postAmendment: screen.postAmendment!,
    });
    const omitted = view.cards?.find((card) => card.omittedLine);
    expect(omitted?.omittedLine).toBeTruthy();
    expect(omitted?.line).toContain(omitted?.omittedLine);
    expect(omitted?.line).not.toContain("— —");
    expect(summary).toContain(omitted?.line);
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
