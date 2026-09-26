"use client";

import { Alert, Group, List, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import {
  defaultRuleset,
  formatMonthIntervals,
  resolveBenefitIntervals,
  type BenefitInput,
  type PatternComparison,
  type SearchResult,
  type SimulationResult,
  type RuleMode,
  type YearMonth,
} from "@/engine";
import { KIND_LABELS, RULE_MODE_LABELS, formatYen } from "@/lib/parse-input";
import { searchLinePoints } from "@/lib/chart-data";
import { PatternBars } from "./PatternBars";
import { SearchLine } from "./SearchLine";

function receiptCaption(receiptYears: Record<string, number>, benefits: BenefitInput[]): string {
  return Object.entries(receiptYears)
    .map(([id, year]) => {
      const index = benefits.findIndex((item) => item.id === id);
      const benefit = index >= 0 ? benefits[index] : undefined;
      const name = benefit ? KIND_LABELS[benefit.kind] : id;
      const clash =
        benefit !== undefined && benefits.filter((item) => item.kind === benefit.kind).length > 1;
      return `${name}${clash ? ` ${index + 1}` : ""} ${year}年`;
    })
    .join("、");
}

function benefitYearList(benefits: BenefitInput[]): string {
  return benefits
    .map((benefit, index) => {
      const clash = benefits.filter((item) => item.kind === benefit.kind).length > 1;
      return `${KIND_LABELS[benefit.kind]}${clash ? ` ${index + 1}` : ""} ${benefit.receiptYear}年`;
    })
    .join("、");
}

function patternCards(patterns: PatternComparison[]) {
  const baselineTax = patterns.find((p) => p.kind === "simultaneous" && !p.omittedReason)?.result
    ?.totalTaxYen;
  const taxes = patterns.flatMap((p) => {
    const tax = p.omittedReason ? null : (p.result?.totalTaxYen ?? null);
    return tax === null ? [] : [tax];
  });
  const bestTax = taxes.length ? Math.min(...taxes) : null;
  return patterns.map((pattern) => {
    const tax = pattern.omittedReason ? null : (pattern.result?.totalTaxYen ?? null);
    const delta = tax !== null && baselineTax != null ? tax - baselineTax : null;
    return {
      pattern,
      tax,
      delta,
      isBest: bestTax !== null && tax === bestTax && !pattern.omittedReason,
    };
  });
}

function autoRegime(year: number): string {
  return year >= defaultRuleset.amendmentEffectiveYear
    ? `${year}年の支払は改正後（${defaultRuleset.amendmentEffectiveYear}年以後）`
    : `${year}年の支払は改正前（${defaultRuleset.amendmentEffectiveYear}年より前）`;
}

function periodLine(benefit: BenefitInput, birth?: YearMonth): string {
  const name = KIND_LABELS[benefit.kind];
  try {
    const intervals = resolveBenefitIntervals(benefit, birth);
    return `${name} ${benefit.receiptYear}年: ${formatMonthIntervals(intervals)}`;
  } catch {
    return `${name} ${benefit.receiptYear}年`;
  }
}

export function ResultPanel({
  result,
  patterns,
  search,
  benefits,
  birth,
  ruleMode,
  preAmendment,
  postAmendment,
}: {
  result: SimulationResult;
  patterns: PatternComparison[] | null;
  search: SearchResult | null;
  benefits: BenefitInput[];
  birth?: YearMonth;
  ruleMode: RuleMode;
  preAmendment: SimulationResult;
  postAmendment: SimulationResult;
}) {
  const cards = patterns ? patternCards(patterns) : null;
  const line = useMemo(
    () => (search && birth ? searchLinePoints(search.hits, benefits, birth.year) : null),
    [benefits, birth, search],
  );
  const currentCaption = benefitYearList(benefits);
  const recommended = search?.best
    ? {
        title: "推奨案（探索全体の最小）",
        caption: receiptCaption(search.best.receiptYears, benefits),
        tax: search.best.result.totalTaxYen,
        net: search.best.result.totalNetYen,
      }
    : cards?.find((card) => card.isBest && card.tax !== null)
      ? {
          title: "推奨案（3案の中で最小）",
          caption: benefitYearList(
            cards.find((card) => card.isBest)?.pattern.input.benefits ?? benefits,
          ),
          tax: cards.find((card) => card.isBest)?.tax ?? null,
          net: cards.find((card) => card.isBest)?.pattern.result?.totalNetYen ?? null,
        }
      : null;
  const nextBest = search && search.hits.length > 1
    ? {
        caption: receiptCaption(search.hits[1].receiptYears, benefits),
        tax: search.hits[1].result.totalTaxYen,
        net: search.hits[1].result.totalNetYen,
      }
    : null;
  const simultaneous = patterns?.find((pattern) => pattern.kind === "simultaneous" && !pattern.omittedReason);
  const comparedTax = recommended?.tax ?? result.totalTaxYen;
  const simultaneousDelta =
    comparedTax !== null && simultaneous?.result?.totalTaxYen != null
      ? comparedTax - simultaneous.result.totalTaxYen
      : null;
  const amendmentDelta =
    preAmendment.totalTaxYen !== null && postAmendment.totalTaxYen !== null
      ? postAmendment.totalTaxYen - preAmendment.totalTaxYen
      : null;
  const blocked = result.warnings.find((warning) => warning.code === "receipt_ineligible");
  const receiptYears = [...new Set(benefits.map((benefit) => benefit.receiptYear))].sort((a, b) => a - b);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2} mb="sm" id="results-heading">
          結果
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <div className="ledger-cell">
            <Text fw={600}>現在の入力</Text>
            <Text size="sm" mt={4} c="var(--ink-muted)">
              {currentCaption}
            </Text>
            {result.totalTaxYen === null ? (
              <Text className="yen" fw={600} fz={20} mt="xs">
                —
              </Text>
            ) : (
              <>
                <Text size="sm" c="dimmed" mt="xs">
                  合計税額
                </Text>
                <Text className="figure yen">{formatYen(result.totalTaxYen)}</Text>
                <Text size="sm" c="dimmed" mt="xs">
                  手取り {formatYen(result.totalNetYen)}
                </Text>
              </>
            )}
          </div>
          {recommended ? (
            <div className="ledger-cell is-best">
              <Text fw={600}>{recommended.title}</Text>
              <Text size="sm" mt={4} c="var(--ink-muted)">
                {recommended.caption}
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                税額
              </Text>
              <Text className="figure yen">{formatYen(recommended.tax)}</Text>
              <Text size="sm" c="dimmed" mt="xs">
                手取り {formatYen(recommended.net)}
              </Text>
            </div>
          ) : null}
        </SimpleGrid>
        {blocked ? (
          <Alert color="yellow" mt="sm">
            {blocked.message}
          </Alert>
        ) : result.totalTaxYen === null ? (
          <Alert color="yellow" mt="sm">
            勤続5年以下の手当があるため、税額は出していません。
          </Alert>
        ) : null}
        {nextBest ? (
          <Text size="sm" mt="sm">
            次善策: {nextBest.caption} ／ 税額 <span className="yen">{formatYen(nextBest.tax)}</span> ／ 手取り{" "}
            <span className="yen">{formatYen(nextBest.net)}</span>
          </Text>
        ) : null}
        {simultaneousDelta !== null && simultaneousDelta !== 0 ? (
          <Text size="sm" mt={4} className="yen">
            同時受取との差額 {simultaneousDelta > 0 ? "+" : ""}
            {formatYen(simultaneousDelta)}
          </Text>
        ) : null}
        <Text size="sm" mt="sm" lh={1.6}>
          退職所得の申告書を提出する前提です。出すのは一時金の税額だけで、年金受取は含みません。試算であり、税務助言ではありません。
        </Text>
        <Stack gap={4} mt="sm">
          {benefits.map((benefit) => (
            <Text key={benefit.id} size="sm" c="var(--ink-muted)">
              {periodLine(benefit, birth)}
            </Text>
          ))}
        </Stack>
        {result.warnings.length > 0 ? (
          <Stack gap={4} mt="sm">
            {result.warnings
              .filter((warning) => warning.code !== "receipt_ineligible")
              .map((warning) => (
              <Text key={warning.code} size="sm" lh={1.6}>
                {warning.message}
              </Text>
            ))}
          </Stack>
        ) : null}
        <Text size="sm" c="dimmed" mt="xs">
          税率テーブル {result.rulesetVersion}
        </Text>
      </div>

      <div>
        <Title order={2}>改正前と改正後</Title>
        <Text size="sm" c="dimmed" mt={4} mb="sm">
          同じ入力・同じ受取年です。左は改正前に固定、右は改正後に固定した税額です。主計算は「{RULE_MODE_LABELS[ruleMode]}」です。
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <div className="ledger-cell">
            <Text fw={600}>改正前に固定</Text>
            <Text className="yen" fw={600} fz={20} mt="xs">
              {formatYen(preAmendment.totalTaxYen)}
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              手取り {formatYen(preAmendment.totalNetYen)}
            </Text>
          </div>
          <div className="ledger-cell">
            <Text fw={600}>改正後に固定</Text>
            <Text className="yen" fw={600} fz={20} mt="xs">
              {formatYen(postAmendment.totalTaxYen)}
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              手取り {formatYen(postAmendment.totalNetYen)}
            </Text>
          </div>
        </SimpleGrid>
        <Text size="sm" mt="sm" className="yen">
          差額（改正後 − 改正前）{" "}
          {amendmentDelta === null ? "—" : `${amendmentDelta > 0 ? "+" : ""}${formatYen(amendmentDelta)}`}
        </Text>
        <Text size="sm" mt={4} c="var(--ink-muted)">
          受取年で自動にすると、{receiptYears.map((year) => autoRegime(year)).join("。")}。
        </Text>
      </div>

      {cards ? (
        <div>
          <Title order={2}>同時 / 退職金先 / iDeCo先</Title>
          <Text size="sm" c="dimmed" mt={4} mb="sm">
            この3案の中の最小です。探索全体の最小とは別に出します。差額の基準は、会社の受取年での同時受取です。
          </Text>
          <PatternBars
            rows={cards.map(({ pattern, tax, isBest }) => ({
              key: pattern.kind,
              label: pattern.label,
              years: benefitYearList(pattern.input.benefits),
              tax,
              isBest,
              omitted: pattern.omittedReason,
            }))}
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt="md">
            {cards.map(({ pattern, tax, delta, isBest }) => (
              <div key={pattern.kind} className={isBest ? "ledger-cell is-best" : "ledger-cell"}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={600} style={{ wordBreak: "keep-all" }}>
                    {pattern.label}
                  </Text>
                  {isBest ? (
                    <Text className="best-label" size="sm" fw={600}>
                      3案の中で最小
                    </Text>
                  ) : null}
                </Group>
                <Text size="sm" mt={4} c="var(--ink-muted)">
                  {benefitYearList(pattern.input.benefits)}
                </Text>
                <Text className="yen" fw={600} fz={20} mt="xs">
                  {pattern.omittedReason ? "—" : formatYen(tax)}
                </Text>
                {delta !== null && delta !== 0 ? (
                  <Text size="sm" c="dimmed" mt={4} className="yen">
                    同時との差 {delta > 0 ? "+" : ""}
                    {formatYen(delta)}
                  </Text>
                ) : null}
                {pattern.omittedReason ? (
                  <Text size="sm" mt="xs" c="var(--ink-muted)">
                    — {pattern.omittedReason}
                  </Text>
                ) : null}
              </div>
            ))}
          </SimpleGrid>
        </div>
      ) : null}

      <div>
        <Title order={3} mb="sm">
          年次の内訳
        </Title>
        <Table.ScrollContainer minWidth={760} type="native">
          <Table withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>受取年</Table.Th>
                <Table.Th>収入</Table.Th>
                <Table.Th>勤続</Table.Th>
                <Table.Th>控除（調整前）</Table.Th>
                <Table.Th>控除（調整後）</Table.Th>
                <Table.Th>課税所得</Table.Th>
                <Table.Th>所得税</Table.Th>
                <Table.Th>復興税</Table.Th>
                <Table.Th>住民税</Table.Th>
                <Table.Th>税額</Table.Th>
                <Table.Th>手取り</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.years.map((year) => (
                <Table.Tr key={year.year}>
                  <Table.Td>{year.year}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.incomeYen)}</Table.Td>
                  <Table.Td>{year.serviceYears}年</Table.Td>
                  <Table.Td className="yen">{formatYen(year.statutoryDeductionYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.deductionAfterAdjustmentYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.taxableYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.incomeTaxYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.reconstructionTaxYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.residentTaxYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.totalTaxYen)}</Table.Td>
                  <Table.Td className="yen">{formatYen(year.netYen)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </div>

      <div>
        <Title order={3} mb="sm">
          計算過程
        </Title>
        {result.years.map((year) => (
          <div key={`steps-${year.year}`} className="ledger-cell" style={{ marginBottom: 12 }}>
            <Text fw={600}>
              {year.year}年（控除 {formatYen(year.statutoryDeductionYen)} → 調整後{" "}
              {formatYen(year.deductionAfterAdjustmentYen)}）
            </Text>
            <List spacing="sm" size="sm" mt="sm">
              {year.steps.map((step) => (
                <List.Item key={step.code}>
                  <Text fw={600} span>
                    {step.label}
                  </Text>
                  : {step.formula}
                  <br />
                  {step.substituted}
                  {step.resultYen !== undefined ? ` = ${formatYen(step.resultYen)}` : ""}
                  {step.resultYears !== undefined ? ` / ${step.resultYears}年` : ""}
                </List.Item>
              ))}
            </List>
            {year.notes.map((note) => (
              <Text key={note} size="sm" c="dimmed" mt="xs">
                {note}
              </Text>
            ))}
          </div>
        ))}
      </div>

      {search ? (
        <div>
          <Title order={2}>受取年の探索</Title>
          {search.truncated ? (
            <Alert color="yellow" mt="sm">
              組合せが {search.combinationCount} あり、{search.hits.length} 件で打ち切りました。
            </Alert>
          ) : (
            <Text size="sm" c="dimmed" mt="xs">
              {search.combinationCount} 通り。税額が小さい順、同額なら受取が早い順です。
            </Text>
          )}
          {search.best ? (
            <Text mt="sm" size="sm">
              探索全体の最小: {receiptCaption(search.best.receiptYears, benefits)} ／{" "}
              <span className="yen">{formatYen(search.best.result.totalTaxYen)}</span>
            </Text>
          ) : null}
          {line ? (
            <SearchLine
              axisLabel={line.axisLabel}
              axisMin={line.axisMin}
              axisMax={line.axisMax}
              points={line.points}
              optimizedPoints={line.optimizedPoints}
            />
          ) : null}
          <Table.ScrollContainer minWidth={360} type="native" mt="sm">
            <Table withRowBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>受取年の組合せ</Table.Th>
                  <Table.Th>税額</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {search.hits.slice(0, 8).map((hit, index) => (
                  <Table.Tr key={JSON.stringify(hit.receiptYears)} className={index === 0 ? "is-best-row" : undefined}>
                    <Table.Td>{receiptCaption(hit.receiptYears, benefits)}</Table.Td>
                    <Table.Td className="yen">{formatYen(hit.result.totalTaxYen)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      ) : null}
    </Stack>
  );
}
