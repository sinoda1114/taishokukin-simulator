"use client";

import {
  Accordion,
  Alert,
  Badge,
  Group,
  List,
  Paper,
  SimpleGrid,
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
    <Stack gap="lg" component="section">
      <div>
        <Title order={2} fz="lg" mb="sm">
          結果
        </Title>
        {result.totalTaxYen === null ? (
          <Alert color="yellow">勤続5年以下の手当があるため、税額は出していません。</Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Paper p="md">
              <Text size="sm" c="dimmed">
                合計税額
              </Text>
              <Text fw={700} fz={{ base: 22, sm: 26 }} lh={1.3}>
                {formatYen(result.totalTaxYen)}
              </Text>
            </Paper>
            <Paper p="md">
              <Text size="sm" c="dimmed">
                手取り
              </Text>
              <Text fw={700} fz={{ base: 22, sm: 26 }} lh={1.3}>
                {formatYen(result.totalNetYen)}
              </Text>
            </Paper>
          </SimpleGrid>
        )}
        <Text size="xs" c="dimmed" mt="xs">
          税率テーブル {result.rulesetVersion}
        </Text>
        {result.warnings.map((w) => (
          <Text key={w.code} size="sm" c="dimmed" mt="xs">
            {w.message}
          </Text>
        ))}
      </div>

      {cards ? (
        <div>
          <Title order={2} fz="lg">
            同時 / 退職金先 / iDeCo先
          </Title>
          <Text size="sm" c="dimmed" mt={4} mb="sm">
            会社退職金1本と DC1本のときだけ、この3行を出します。同時との差額は会社の受取年での同時受取が基準です。
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {cards.map(({ pattern, tax, delta, isBest }) => (
                <Paper
                  key={pattern.kind}
                  p="md"
                  bd={isBest ? "2px solid var(--mantine-color-teal-6)" : undefined}
                >
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text fw={600} style={{ wordBreak: "keep-all" }}>
                      {pattern.label}
                    </Text>
                    {isBest ? (
                      <Badge color="teal" variant="light">
                        税額最小
                      </Badge>
                    ) : null}
                  </Group>
                  <Text fw={700} fz={20} mt="xs">
                    {pattern.omittedReason ? "—" : formatYen(tax)}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    同時との差{" "}
                    {delta === null ? "—" : `${delta > 0 ? "+" : ""}${formatYen(delta)}`}
                  </Text>
                  {pattern.omittedReason ? (
                    <Text size="sm" c="yellow.8" mt="xs">
                      {pattern.omittedReason}
                    </Text>
                  ) : null}
                </Paper>
            ))}
          </SimpleGrid>
        </div>
      ) : null}

      <div>
        <Title order={3} fz="md" mb="sm">
          年次の内訳
        </Title>
        <Table.ScrollContainer minWidth={720} type="native">
          <Table striped highlightOnHover withTableBorder>
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
                  <Table.Td>{formatYen(year.incomeYen)}</Table.Td>
                  <Table.Td>{year.serviceYears}年</Table.Td>
                  <Table.Td>{formatYen(year.deductionAfterAdjustmentYen)}</Table.Td>
                  <Table.Td>{formatYen(year.taxableYen)}</Table.Td>
                  <Table.Td>{formatYen(year.incomeTaxYen)}</Table.Td>
                  <Table.Td>{formatYen(year.reconstructionTaxYen)}</Table.Td>
                  <Table.Td>{formatYen(year.residentTaxYen)}</Table.Td>
                  <Table.Td>{formatYen(year.totalTaxYen)}</Table.Td>
                  <Table.Td>{formatYen(year.netYen)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </div>

      <Accordion variant="separated">
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
          <Title order={2} fz="lg">
            受取年の探索
          </Title>
          {search.truncated ? (
            <Alert color="yellow" mt="sm">
              組合せが {search.combinationCount} あり、{search.hits.length} 件で打ち切りました。
            </Alert>
          ) : (
            <Text size="sm" c="dimmed" mt="xs">
              探索 {search.combinationCount} 通り。税額最小を先に、同じ税額なら受取が早い順です。
            </Text>
          )}
          {search.best ? (
            <Alert color="teal" mt="sm">
              税額最小の試算: {receiptCaption(search.best.receiptYears, benefits)} ／{" "}
              {formatYen(search.best.result.totalTaxYen)}
            </Alert>
          ) : null}
          <Table.ScrollContainer minWidth={360} type="native" mt="sm">
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>受取年</Table.Th>
                  <Table.Th>税額</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {search.hits.slice(0, 8).map((hit, index) => (
                  <Table.Tr key={JSON.stringify(hit.receiptYears)} bg={index === 0 ? "teal.0" : undefined}>
                    <Table.Td>{receiptCaption(hit.receiptYears, benefits)}</Table.Td>
                    <Table.Td>{formatYen(hit.result.totalTaxYen)}</Table.Td>
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
