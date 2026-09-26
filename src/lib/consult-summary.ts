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

function signedYen(delta: number): string {
  return `${delta > 0 ? "+" : ""}${formatYen(delta)}`;
}

export function buildConsultSummary(screen: ConsultScreen): string {
  if (screen.phase === "hearing") return HEARING_SUMMARY;

  const lines: string[] = ["入力"];
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

  lines.push("結果");
  lines.push(`現在の入力: ${view.currentCaption}`);
  if (result.totalTaxYen === null) {
    lines.push("合計税額: 出していません");
    lines.push("手取り: 出していません");
  } else {
    lines.push(`合計税額: ${formatYen(result.totalTaxYen)}`);
    lines.push(`手取り: ${formatYen(result.totalNetYen)}`);
  }
  if (view.blocked) lines.push(`注意: ${view.blocked.message}`);
  else if (result.totalTaxYen === null) {
    lines.push("注意: 勤続5年以下の手当があるため、税額は出していません。");
  }
  if (view.recommended) {
    lines.push(`${view.recommended.title}: ${view.recommended.caption}`);
    lines.push(`推奨の税額: ${formatYen(view.recommended.tax)}`);
    lines.push(`推奨の手取り: ${formatYen(view.recommended.net)}`);
  }
  if (view.nextBest) {
    lines.push(
      `次善策: ${view.nextBest.caption} 税額 ${formatYen(view.nextBest.tax)} 手取り ${formatYen(view.nextBest.net)}`,
    );
  }
  if (view.simultaneousDelta !== null && view.simultaneousDelta !== 0) {
    lines.push(`同時受取との差額: ${signedYen(view.simultaneousDelta)}`);
  }
  lines.push(
    "画面の注記: 退職所得の申告書を提出する前提です。出すのは一時金の税額だけで、年金受取は含みません。試算であり、税務助言ではありません。",
  );
  for (const period of view.periods) lines.push(period.text);
  for (const warning of result.warnings) {
    if (warning.code === "receipt_ineligible") continue;
    lines.push(`注意: ${warning.message}`);
  }
  lines.push(`税率テーブル: ${result.rulesetVersion}`);
  lines.push(
    `改正前に固定: 税額 ${formatYen(screen.preAmendment.totalTaxYen)} 手取り ${formatYen(screen.preAmendment.totalNetYen)}`,
  );
  lines.push(
    `改正後に固定: 税額 ${formatYen(screen.postAmendment.totalTaxYen)} 手取り ${formatYen(screen.postAmendment.totalNetYen)}`,
  );
  lines.push(
    `差額（改正後 − 改正前）: ${view.amendmentDelta === null ? "—" : signedYen(view.amendmentDelta)}`,
  );
  lines.push(`受取年で自動: ${view.regimeLine}。`);
  lines.push(`主計算: ${view.ruleModeLabel}`);

  if (view.cards) {
    lines.push("同時 / 退職金先 / iDeCo先（この3案の中の最小。探索全体の最小とは別）");
    for (const card of view.cards) {
      const deltaText =
        card.delta !== null && card.delta !== 0 ? ` 同時との差 ${signedYen(card.delta)}` : "";
      const omitted = card.pattern.omittedReason ? ` — ${card.pattern.omittedReason}` : "";
      lines.push(
        `- ${card.pattern.label}: ${card.years} 税額 ${card.pattern.omittedReason ? "—" : formatYen(card.tax)}${deltaText}${omitted}`,
      );
    }
  }

  lines.push("年次の内訳");
  for (const year of result.years) {
    lines.push(
      `- ${year.year}年 収入 ${formatYen(year.incomeYen)} 勤続 ${year.serviceYears}年 控除（調整前） ${formatYen(year.statutoryDeductionYen)} 控除（調整後） ${formatYen(year.deductionAfterAdjustmentYen)} 課税所得 ${formatYen(year.taxableYen)} 所得税 ${formatYen(year.incomeTaxYen)} 復興税 ${formatYen(year.reconstructionTaxYen)} 住民税 ${formatYen(year.residentTaxYen)} 税額 ${formatYen(year.totalTaxYen)} 手取り ${formatYen(year.netYen)}`,
    );
  }

  if (view.searchNote) {
    lines.push("受取年の探索");
    lines.push(view.searchNote);
    if (view.searchBestLine) lines.push(`${view.searchBestLine} 税額 ${formatYen(view.searchBestTax)}`);
    for (const row of view.searchRows) lines.push(`- ${row.caption} 税額 ${formatYen(row.tax)}`);
  }

  return lines.join("\n");
}
