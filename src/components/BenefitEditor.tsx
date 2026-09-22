"use client";

import { Button, Checkbox, Group, Paper, Select, SimpleGrid, Stack, TextInput } from "@mantine/core";
import type { BenefitInput } from "@/engine";
import { IntInput } from "./IntInput";
import { isBenefitKind, KIND_LABELS } from "@/lib/parse-input";

const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function parseYearMonth(value: string): { year: number; month: number } | null {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

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
  const n = index + 1;

  function patchInterval(i: number, side: "start" | "end", value: string) {
    const ym = parseYearMonth(value);
    if (!ym) return;
    const next = [...(benefit.intervals ?? [])];
    const current = next[i];
    if (!current) return;
    next[i] = { ...current, [side]: ym };
    onChange({ intervals: next });
  }

  return (
    <Paper className="panel" p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-end">
          <Select
            label={`手当 ${n}`}
            data={KIND_OPTIONS}
            value={benefit.kind}
            onChange={(value) => {
              if (value && isBenefitKind(value)) onChange({ kind: value });
            }}
            allowDeselect={false}
            style={{ flex: 1 }}
          />
          {canRemove ? (
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={onRemove}
              aria-label={`手当 ${n} を削除`}
            >
              削除
            </Button>
          ) : null}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <IntInput
            label="見込み受取額（円）"
            thousandSeparator=","
            min={0}
            value={benefit.incomeYen}
            onValue={(incomeYen) => onChange({ incomeYen })}
          />
          <IntInput
            label="受取年"
            min={1980}
            max={2200}
            value={benefit.receiptYear}
            emptyValue={benefit.receiptYear}
            onValue={(receiptYear) => onChange({ receiptYear })}
          />
          <IntInput
            label="勤続年数（簡易）"
            min={1}
            max={80}
            disabled={useIntervals}
            value={benefit.serviceYears ?? ""}
            emptyValue={1}
            onValue={(serviceYears) => onChange({ serviceYears: Math.max(1, serviceYears) })}
          />
          {benefit.kind === "dc" ? (
            <IntInput
              label="拠出終了年齢（任意）"
              min={50}
              max={75}
              value={benefit.contributionEndAge ?? ""}
              onEmpty={() => onChange({ contributionEndAge: undefined })}
              onValue={(contributionEndAge) => onChange({ contributionEndAge })}
            />
          ) : null}
        </SimpleGrid>
        {canOptimize ? (
          <Checkbox
            label="受取年を探索（iDeCo は 60〜75歳）"
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
          label="勤続を年月で入れる"
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
                  onChange={(e) => patchInterval(i, "start", e.currentTarget.value)}
                />
                <TextInput
                  label="終了"
                  type="month"
                  value={`${interval.end.year}-${String(interval.end.month).padStart(2, "0")}`}
                  onChange={(e) => patchInterval(i, "end", e.currentTarget.value)}
                />
              </Group>
            ))
          : null}
      </Stack>
    </Paper>
  );
}
