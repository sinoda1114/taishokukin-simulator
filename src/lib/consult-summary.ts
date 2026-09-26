import type { BenefitInput, PatternComparison, RuleMode, SearchResult, SimulationResult } from "@/engine";
import { KIND_LABELS, RULE_MODE_LABELS, formatYen } from "@/lib/parse-input";
import { buildResultView } from "@/lib/result-view";

export type ConsultScreen = {
  phase: "hearing" | "results";
  birthYear: number | null;
  birthMonth: number | null;
  ruleMode: RuleMode;
  benefits: BenefitInput[];
  result: SimulationResult | null;
  preAmendment: SimulationResult | null;
  postAmendment: SimulationResult | null;
  patterns: PatternComparison[] | null;
  search: SearchResult | null;
};

const HEARING_SUMMARY = "いまは質問の画面です。結果の税額は出ていません。";

function benefitName(benefit: BenefitInput, benefits: BenefitInput[], index: number): string {
  const clash = benefits.filter((item) => item.kind === benefit.kind).length > 1;
  return `${KIND_LABELS[benefit.kind]}${clash ? ` ${index + 1}` : ""}`;
}

function inputLines(screen: ConsultScreen): string[] {
  const lines = ["入力"];
  if (screen.birthYear !== null && screen.birthMonth !== null) {
    lines.push(`生年月: ${screen.birthYear}年${screen.birthMonth}月`);
  } else {
    lines.push("生年月: 未入力");
  }
  lines.push(`適用ルール: ${RULE_MODE_LABELS[screen.ruleMode]}`);
  lines.push("手当:");
  screen.benefits.forEach((benefit, index) => {
    const service = benefit.serviceYears !== undefined ? `${benefit.serviceYears}年` : "年数は年次の内訳を参照";
    const optimize = benefit.optimizeReceiptYear ? " 受取年を探索する" : "";
    lines.push(
      `- ${benefitName(benefit, screen.benefits, index)} 収入 ${formatYen(benefit.incomeYen)} 勤続 ${service} 受取年 ${benefit.receiptYear}年${optimize}`,
    );
  });
  return lines;
}

export function buildConsultSummary(screen: ConsultScreen): string {
  if (screen.phase === "hearing") return HEARING_SUMMARY;

  const lines = inputLines(screen);
  const result = screen.result;
  if (!result || !screen.preAmendment || !screen.postAmendment) {
    lines.push("結果: 税額は出ていません。");
    return lines.join("\n");
  }

  const birth =
    screen.birthYear !== null && screen.birthMonth !== null
      ? { year: screen.birthYear, month: screen.birthMonth }
      : undefined;
  const view = buildResultView({
    result,
    patterns: screen.patterns,
    search: screen.search,
    benefits: screen.benefits,
    birth,
    ruleMode: screen.ruleMode,
    preAmendment: screen.preAmendment,
    postAmendment: screen.postAmendment,
  });
  return [...lines, ...view.screenLines].join("\n");
}
