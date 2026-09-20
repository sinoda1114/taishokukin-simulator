"use client";

import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import type { BenefitInput, BenefitKind } from "@/engine";
import { KIND_LABELS } from "@/lib/parse-input";
import { toInt } from "@/lib/ui-numbers";

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as BenefitKind[]).map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind],
}));

export function BenefitEditor({
  index,
  benefit,
  onChange,
  onRemove,
  canRemove,
  canOptimize,
}: {
  index: number;
  benefit: BenefitInput;
  onChange: (patch: Partial<BenefitInput>) => void;
  onRemove: () => void;
  canRemove: boolean;
  canOptimize: boolean;
}) {
  const useIntervals = Boolean(benefit.intervals && benefit.intervals.length > 0);

  return (
    <Stack gap="sm" p="md" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Title order={3} fz="md" style={{ wordBreak: "keep-all" }}>
          退職手当等 {index + 1}
        </Title>
        {canRemove ? (
          <Button type="button" variant="default" size="compact-sm" onClick={onRemove}>
            削除
          </Button>
        ) : null}
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Select
          label="種類"
          data={KIND_OPTIONS}
          value={benefit.kind}
          onChange={(value) => {
            if (value) onChange({ kind: value as BenefitKind });
          }}
          allowDeselect={false}
        />
        <NumberInput
          label="見込み受取額（円）"
          thousandSeparator=","
          hideControls
          allowDecimal={false}
          allowNegative={false}
          min={0}
          value={benefit.incomeYen}
          onChange={(value) => onChange({ incomeYen: toInt(value, 0) })}
        />
        <NumberInput
          label="受取年"
          hideControls
          allowDecimal={false}
          allowNegative={false}
          min={1980}
          max={2200}
          value={benefit.receiptYear}
          onChange={(value) => onChange({ receiptYear: toInt(value, benefit.receiptYear) })}
        />
        <NumberInput
          label="勤続年数（簡易）"
          hideControls
          allowDecimal={false}
          allowNegative={false}
          min={1}
          max={80}
          disabled={useIntervals}
          value={benefit.serviceYears ?? ""}
          onChange={(value) => onChange({ serviceYears: Math.max(1, toInt(value, 1)) })}
        />
        {benefit.kind === "dc" ? (
          <NumberInput
            label="拠出終了年齢（任意）"
            hideControls
            allowDecimal={false}
            allowNegative={false}
            min={50}
            max={75}
            value={benefit.contributionEndAge ?? ""}
            onChange={(value) =>
              onChange({
                contributionEndAge: value === "" ? undefined : toInt(value),
              })
            }
          />
        ) : null}
      </SimpleGrid>
      {canOptimize ? (
        <Checkbox
          label="受取年を探索する（iDeCo は 60〜75歳の暦年）"
          checked={Boolean(benefit.optimizeReceiptYear)}
          onChange={(e) => onChange({ optimizeReceiptYear: e.currentTarget.checked })}
        />
      ) : null}
      <Checkbox
        label="障害退職（控除 +100万円）"
        checked={Boolean(benefit.disability)}
        onChange={(e) => onChange({ disability: e.currentTarget.checked })}
      />
      <Checkbox
        label="勤続期間を年月の区間で入力する"
        checked={useIntervals}
        onChange={(e) => {
          if (e.currentTarget.checked) {
            onChange({
              intervals: [
                {
                  start: {
                    year: benefit.receiptYear - (benefit.serviceYears ?? 20) + 1,
                    month: 1,
                  },
                  end: { year: benefit.receiptYear, month: 12 },
                },
              ],
            });
          } else {
            onChange({ intervals: undefined, serviceYears: benefit.serviceYears ?? 20 });
          }
        }}
      />
      {useIntervals
        ? benefit.intervals?.map((interval, i) => (
            <Group key={`${benefit.id}-iv-${i}`} grow preventGrowOverflow={false} wrap="wrap">
              <TextInput
                label="開始"
                type="month"
                value={`${interval.start.year}-${String(interval.start.month).padStart(2, "0")}`}
                onChange={(e) => {
                  const [y, m] = e.currentTarget.value.split("-").map(Number);
                  if (!y || !m) return;
                  const next = [...(benefit.intervals ?? [])];
                  next[i] = { ...interval, start: { year: y, month: m } };
                  onChange({ intervals: next });
                }}
              />
              <TextInput
                label="終了"
                type="month"
                value={`${interval.end.year}-${String(interval.end.month).padStart(2, "0")}`}
                onChange={(e) => {
                  const [y, m] = e.currentTarget.value.split("-").map(Number);
                  if (!y || !m) return;
                  const next = [...(benefit.intervals ?? [])];
                  next[i] = { ...interval, end: { year: y, month: m } };
                  onChange({ intervals: next });
                }}
              />
            </Group>
          ))
        : null}
    </Stack>
  );
}
