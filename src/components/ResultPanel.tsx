"use client";

import { Alert, Group, List, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import type { BenefitInput, PatternComparison, RuleMode, SearchResult, SimulationResult, YearMonth } from "@/engine";
import { formatYen } from "@/lib/parse-input";
import { searchLinePoints } from "@/lib/chart-data";
import { buildResultView } from "@/lib/result-view";
import { PatternBars } from "./PatternBars";
import { SearchLine } from "./SearchLine";

export function ResultPanel({
  result,
  patterns,
  search,
  benefits,
  birth,
  ruleMode,
  preAmendment,
  postAmendment,
  onConsult,
}: {
  result: SimulationResult;
  patterns: PatternComparison[] | null;
  search: SearchResult | null;
  benefits: BenefitInput[];
  birth?: YearMonth;
  ruleMode: RuleMode;
  preAmendment: SimulationResult;
  postAmendment: SimulationResult;
  onConsult: () => void;
}) {
  const view = buildResultView({
    result,
    patterns,
    search,
    benefits,
    birth,
    ruleMode,
    preAmendment,
    postAmendment,
  });
  const {
    cards,
    currentCaption,
    recommended,
    nextBest,
    simultaneousDelta,
    amendmentDelta,
    showTax,
    taxNotice,
    disclaimer,
    yearHeaders,
    yearRows,
    amendmentTitle,
    amendmentLead,
    preFixedTax,
    preFixedNet,
    postFixedTax,
    postFixedNet,
    patternTitle,
    patternLead,
    regimeLine,
    periods,
    searchNote,
    searchBestLine,
    searchBestTax,
    searchRows,
  } = view;
  const line = useMemo(
    () => (search && birth ? searchLinePoints(search.hits, benefits, birth.year) : null),
    [benefits, birth, search],
  );

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
            {showTax ? (
              <>
                <Text size="sm" c="dimmed" mt="xs">
                  合計税額
                </Text>
                <Text className="figure yen">{formatYen(result.totalTaxYen)}</Text>
                <Text size="sm" c="dimmed" mt="xs">
                  手取り {formatYen(result.totalNetYen)}
                </Text>
              </>
            ) : (
              <Text className="yen" fw={600} fz={20} mt="xs">
                —
              </Text>
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
        {taxNotice ? (
          <Alert color="yellow" mt="sm">
            {taxNotice}
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
          {disclaimer}
        </Text>
        <Stack gap={4} mt="sm">
          {periods.map((period) => (
            <Text key={period.id} size="sm" c="var(--ink-muted)">
              {period.text}
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
        <Title order={2}>{amendmentTitle}</Title>
        <Text size="sm" c="dimmed" mt={4} mb="sm">
          {amendmentLead}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <div className="ledger-cell">
            <Text fw={600}>改正前に固定</Text>
            <Text className="yen" fw={600} fz={20} mt="xs">
              {formatYen(preFixedTax)}
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              手取り {formatYen(preFixedNet)}
            </Text>
          </div>
          <div className="ledger-cell">
            <Text fw={600}>改正後に固定</Text>
            <Text className="yen" fw={600} fz={20} mt="xs">
              {formatYen(postFixedTax)}
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              手取り {formatYen(postFixedNet)}
            </Text>
          </div>
        </SimpleGrid>
        <Text size="sm" mt="sm" className="yen">
          差額（改正後 − 改正前）{" "}
          {amendmentDelta === null ? "—" : `${amendmentDelta > 0 ? "+" : ""}${formatYen(amendmentDelta)}`}
        </Text>
        <Text size="sm" mt={4} c="var(--ink-muted)">
          受取年で自動にすると、{regimeLine}。
        </Text>
      </div>

      {cards && patternTitle && patternLead ? (
        <div>
          <Title order={2}>{patternTitle}</Title>
          <Text size="sm" c="dimmed" mt={4} mb="sm">
            {patternLead}
          </Text>
          <PatternBars
            rows={cards.map(({ pattern, tax, isBest, years }) => ({
              key: pattern.kind,
              label: pattern.label,
              years,
              tax,
              isBest,
              omitted: pattern.omittedReason,
            }))}
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt="md">
            {cards.map(({ pattern, tax, delta, isBest, years }) => (
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
                  {years}
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
                {yearHeaders.map((header) => (
                  <Table.Th key={header}>{header}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {yearRows.map((row) => (
                <Table.Tr key={row.year}>
                  {row.cells.map((cell, index) => (
                    <Table.Td key={yearHeaders[index]} className={index === 0 || index === 2 ? undefined : "yen"}>
                      {cell}
                    </Table.Td>
                  ))}
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
              {searchNote}
            </Alert>
          ) : (
            <Text size="sm" c="dimmed" mt="xs">
              {searchNote}
            </Text>
          )}
          {searchBestLine ? (
            <Text mt="sm" size="sm">
              {searchBestLine} ／ <span className="yen">{formatYen(searchBestTax)}</span>
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
                {searchRows.map((row, index) => (
                  <Table.Tr key={`${row.caption}-${index}`} className={index === 0 ? "is-best-row" : undefined}>
                    <Table.Td>{row.caption}</Table.Td>
                    <Table.Td className="yen">{formatYen(row.tax)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      ) : null}

      <div className="consult-end">
        <button type="button" className="consult-open" onClick={onConsult}>
          AIに相談
        </button>
        <Text size="sm" c="dimmed" mt={8}>
          画面に出ている数字の説明です。税務助言ではありません。
        </Text>
      </div>
    </Stack>
  );
}
