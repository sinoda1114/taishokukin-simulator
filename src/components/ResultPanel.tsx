"use client";

import {
  Accordion,
  Alert,
  Group,
  List,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import type { BenefitInput, PatternComparison, SearchResult, SimulationResult } from "@/engine";
import { KIND_LABELS, formatYen } from "@/lib/parse-input";

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
      isBest: bestTax !== null && tax === bestTax,
    };
  });
}

export function ResultPanel({
  result,
  patterns,
  search,
  benefits,
}: {
  result: SimulationResult;
  patterns: PatternComparison[] | null;
  search: SearchResult | null;
  benefits: BenefitInput[];
}) {
  const cards = patterns ? patternCards(patterns) : null;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2} mb="sm" id="results-heading">
          結果
        </Title>
        {result.totalTaxYen === null ? (
          <Alert color="yellow">勤続5年以下の手当があるため、税額は出していません。</Alert>
        ) : (
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
            <div>
              <Text size="sm" c="dimmed">
                合計税額
              </Text>
              <Text className="figure yen">{formatYen(result.totalTaxYen)}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                手取り
              </Text>
              <Text className="figure yen">{formatYen(result.totalNetYen)}</Text>
            </div>
          </Group>
        )}
        <Text size="sm" c="dimmed" mt="xs">
          税率テーブル {result.rulesetVersion}
        </Text>
        {result.warnings.length > 0 ? (
          <Accordion mt="sm" variant="default">
            <Accordion.Item value="warnings">
              <Accordion.Control>注意 {result.warnings.length}件</Accordion.Control>
              <Accordion.Panel>
                {result.warnings.map((w) => (
                  <Text key={w.code} size="sm" c="dimmed">
                    {w.message}
                  </Text>
                ))}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        ) : null}
      </div>

      {cards ? (
        <div>
          <Title order={2}>同時 / 退職金先 / iDeCo先</Title>
          <Text size="sm" c="dimmed" mt={4} mb="sm">
            会社1本と DC1本のときだけ出します。差額の基準は会社の受取年での同時受取です。
          </Text>
          <div className="ledger">
            {cards.map(({ pattern, tax, delta, isBest }) => (
              <div key={pattern.kind} className={isBest ? "ledger-cell is-best" : "ledger-cell"}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={600} style={{ wordBreak: "keep-all" }}>
                    {pattern.label}
                  </Text>
                  {isBest ? (
                    <Text className="best-label" size="sm" fw={600}>
                      税額最小
                    </Text>
                  ) : null}
                </Group>
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
                    {pattern.omittedReason}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Accordion variant="default">
        <Accordion.Item value="years">
          <Accordion.Control>年次の内訳</Accordion.Control>
          <Accordion.Panel>
            <Table.ScrollContainer minWidth={720} type="native">
              <Table withRowBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>受取年</Table.Th>
                    <Table.Th>収入</Table.Th>
                    <Table.Th>勤続</Table.Th>
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
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Accordion variant="default">
        {result.years.map((year) => (
          <Accordion.Item key={`steps-${year.year}`} value={String(year.year)}>
            <Accordion.Control>
              {year.year}年の計算過程（控除 {formatYen(year.statutoryDeductionYen)} → 調整後{" "}
              {formatYen(year.deductionAfterAdjustmentYen)}）
            </Accordion.Control>
            <Accordion.Panel>
              <List spacing="sm" size="sm">
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
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

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
              税額最小の試算: {receiptCaption(search.best.receiptYears, benefits)} ／{" "}
              <span className="yen">{formatYen(search.best.result.totalTaxYen)}</span>
            </Text>
          ) : null}
          <Table.ScrollContainer minWidth={360} type="native" mt="sm">
            <Table withRowBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>受取年</Table.Th>
                  <Table.Th>税額</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {search.hits.slice(0, 8).map((hit, index) => (
                  <Table.Tr
                    key={JSON.stringify(hit.receiptYears)}
                    className={index === 0 ? "is-best-row" : undefined}
                  >
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
