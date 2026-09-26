"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { ageInCalendarYear, membershipYears, yearOfAge, type BenefitInput, type YearMonth } from "@/engine";
import { IntInput } from "./IntInput";
import { IntPickerField } from "./IntPickerField";
import { ReceiptAgeField } from "./ReceiptAgeField";
import { isBenefitKind, KIND_LABELS } from "@/lib/parse-input";
import { CONTRIBUTION_END_NOTE, contributionEndBounds, FIELD_RANGES } from "@/lib/field-ranges";
import {
  intervalOrderError,
  parseContributionEndAge,
  parseCountedInt,
  parseIncomeYen,
  parseMonth,
  parseReceiptAge,
  parseServiceYears,
  receiptYearFromAge,
  serviceConflictsWithReceipt,
} from "@/lib/field-validation";

const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

type IntervalDraft = { startYear: string; startMonth: string; endYear: string; endMonth: string };

function parseYearField(raw: string, label: string) {
  return parseCountedInt(raw, {
    label,
    min: FIELD_RANGES.birthYear.min,
    max: FIELD_RANGES.receiptYear.max,
  });
}

export function BenefitEditor({
  index,
  benefit,
  birth,
  onChange,
  onRemove,
  onValidityChange,
  canRemove,
  canOptimize,
}: {
  index: number;
  benefit: BenefitInput;
  birth?: YearMonth;
  onChange: (patch: Partial<BenefitInput>) => void;
  onRemove: () => void;
  onValidityChange: (ok: boolean) => void;
  canRemove: boolean;
  canOptimize: boolean;
}) {
  const useIntervals = Boolean(benefit.intervals && benefit.intervals.length > 0);
  const n = index + 1;
  const age = birth ? ageInCalendarYear(birth, benefit.receiptYear) : null;
  const [incomeRaw, setIncomeRaw] = useState(String(benefit.incomeYen));
  const [serviceRaw, setServiceRaw] = useState(String(benefit.serviceYears ?? 20));
  const [ageRaw, setAgeRaw] = useState(age === null ? "" : String(age));
  const [endAgeRaw, setEndAgeRaw] = useState(
    benefit.contributionEndAge === undefined ? "" : String(benefit.contributionEndAge),
  );
  const [intervalDrafts, setIntervalDrafts] = useState<IntervalDraft[]>(() =>
    (benefit.intervals ?? []).map((interval) => ({
      startYear: String(interval.start.year),
      startMonth: String(interval.start.month),
      endYear: String(interval.end.year),
      endMonth: String(interval.end.month),
    })),
  );

  useEffect(() => {
    setIncomeRaw(String(benefit.incomeYen));
  }, [benefit.incomeYen]);
  useEffect(() => {
    if (benefit.serviceYears !== undefined) setServiceRaw(String(benefit.serviceYears));
  }, [benefit.serviceYears]);
  useEffect(() => {
    setAgeRaw(age === null ? "" : String(age));
  }, [age]);
  useEffect(() => {
    setEndAgeRaw(benefit.contributionEndAge === undefined ? "" : String(benefit.contributionEndAge));
  }, [benefit.contributionEndAge]);
  useEffect(() => {
    setIntervalDrafts(
      (benefit.intervals ?? []).map((interval) => ({
        startYear: String(interval.start.year),
        startMonth: String(interval.start.month),
        endYear: String(interval.end.year),
        endMonth: String(interval.end.month),
      })),
    );
  }, [benefit.intervals]);

  const membership = membershipYears(benefit);
  const receiptAge = birth ? ageInCalendarYear(birth, benefit.receiptYear) : null;
  const endBounds = contributionEndBounds(benefit.kind === "dc" ? receiptAge : null);

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    const income = parseIncomeYen(incomeRaw);
    if (!income.ok) next.income = income.error;
    const ageContext = { kind: benefit.kind, serviceYears: membershipYears(benefit) };
    if (!useIntervals) {
      const service = parseServiceYears(serviceRaw);
      if (!service.ok) next.service = service.error;
      const parsedAge = parseReceiptAge(ageRaw, birth?.year ?? null, {
        ...ageContext,
        serviceYears: service.ok ? service.value : ageContext.serviceYears,
      });
      if (!parsedAge.ok) next.age = parsedAge.error;
      if (service.ok && parsedAge.ok && birth) {
        const conflict = serviceConflictsWithReceipt(
          service.value,
          receiptYearFromAge(birth.year, parsedAge.value),
          birth,
        );
        if (conflict) next.age = conflict;
      }
    } else {
      const parsedAge = parseReceiptAge(ageRaw, birth?.year ?? null, ageContext);
      if (!parsedAge.ok) next.age = parsedAge.error;
      intervalDrafts.forEach((draft, i) => {
        const startYear = parseYearField(draft.startYear, "開始年");
        const startMonth = parseMonth(draft.startMonth, "開始月");
        const endYear = parseYearField(draft.endYear, "終了年");
        const endMonth = parseMonth(draft.endMonth, "終了月");
        if (!startYear.ok) next[`startYear-${i}`] = startYear.error;
        if (!startMonth.ok) next[`startMonth-${i}`] = startMonth.error;
        if (!endYear.ok) next[`endYear-${i}`] = endYear.error;
        if (!endMonth.ok) next[`endMonth-${i}`] = endMonth.error;
        if (startYear.ok && startMonth.ok && endYear.ok && endMonth.ok) {
          const order = intervalOrderError(
            { year: startYear.value, month: startMonth.value },
            { year: endYear.value, month: endMonth.value },
          );
          if (order) next[`endYear-${i}`] = order;
        }
      });
    }
    if (benefit.kind === "dc" && endAgeRaw.trim() !== "") {
      const endAge = parseContributionEndAge(endAgeRaw, birth ? ageInCalendarYear(birth, benefit.receiptYear) : null);
      if (!endAge.ok) next.endAge = endAge.error;
    }
    return next;
  }, [ageRaw, benefit, birth, endAgeRaw, incomeRaw, intervalDrafts, serviceRaw, useIntervals]);

  const reportedOk = useRef<boolean | null>(null);
  useEffect(() => {
    const ok = Object.keys(errors).length === 0;
    if (reportedOk.current === ok) return;
    reportedOk.current = ok;
    onValidityChange(ok);
  }, [errors, onValidityChange]);

  function commitAge(raw: string) {
    setAgeRaw(raw);
    if (!birth) return;
    const parsed = parseReceiptAge(raw, birth.year, {
      kind: benefit.kind,
      serviceYears: membershipYears(benefit),
    });
    if (parsed.ok) onChange({ receiptYear: yearOfAge(birth, parsed.value) });
  }

  function commitService(raw: string) {
    setServiceRaw(raw);
    const parsed = parseServiceYears(raw);
    if (parsed.ok) onChange({ serviceYears: parsed.value });
  }

  function commitInterval(i: number, patch: Partial<IntervalDraft>) {
    const next = intervalDrafts.map((draft, index) => (index === i ? { ...draft, ...patch } : draft));
    setIntervalDrafts(next);
    const draft = next[i];
    if (!draft || !benefit.intervals) return;
    const startYear = parseYearField(draft.startYear, "開始年");
    const startMonth = parseMonth(draft.startMonth, "開始月");
    const endYear = parseYearField(draft.endYear, "終了年");
    const endMonth = parseMonth(draft.endMonth, "終了月");
    if (!startYear.ok || !startMonth.ok || !endYear.ok || !endMonth.ok) return;
    const intervals = [...benefit.intervals];
    intervals[i] = {
      start: { year: startYear.value, month: startMonth.value },
      end: { year: endYear.value, month: endMonth.value },
    };
    onChange({ intervals });
  }

  return (
    <Paper className="panel" p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="sm" align="flex-end">
          <Select
            label={`手当 ${n}`}
            data={KIND_OPTIONS}
            value={benefit.kind}
            onChange={(value) => {
              if (!value || !isBenefitKind(value)) return;
              if (value !== "dc") {
                setEndAgeRaw("");
                onChange({ kind: value, contributionEndAge: undefined });
                return;
              }
              onChange({ kind: value });
            }}
            allowDeselect={false}
            style={{ flex: "1 1 12rem", minWidth: 0 }}
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
        <IntInput
          label="見込み受取額（円）"
          thousandSeparator=","
          min={0}
          value={incomeRaw === "" ? "" : benefit.incomeYen}
          error={errors.income}
          onEmpty={() => setIncomeRaw("")}
          onValue={(incomeYen) => {
            setIncomeRaw(String(incomeYen));
            onChange({ incomeYen });
          }}
        />
        <ReceiptAgeField
          value={ageRaw}
          birthYear={birth?.year ?? null}
          kind={benefit.kind}
          serviceYears={membership}
          error={errors.age}
          onChange={commitAge}
        />
        {useIntervals ? (
          <Stack gap="sm">
          {intervalDrafts.map((draft, i) => (
            <Stack key={`${benefit.id}-iv-${i}`} gap="sm">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600}>
                  区間 {i + 1}
                </Text>
                <Button
                  type="button"
                  variant="default"
                  size="compact-sm"
                  aria-label={`区間 ${i + 1} を削除`}
                  onClick={() => {
                    const next = (benefit.intervals ?? []).filter((_, index) => index !== i);
                    if (next.length === 0) {
                      onChange({ intervals: undefined, serviceYears: benefit.serviceYears ?? 20 });
                      return;
                    }
                    onChange({ intervals: next });
                  }}
                >
                  この区間を削除
                </Button>
              </Group>
              <Group grow preventGrowOverflow={false} wrap="wrap">
                <IntPickerField
                  label="開始年"
                  min={FIELD_RANGES.birthYear.min}
                  max={FIELD_RANGES.receiptYear.max}
                  optionSuffix="年"
                  value={draft.startYear}
                  error={errors[`startYear-${i}`]}
                  onChange={(startYear) => commitInterval(i, { startYear })}
                />
                <IntPickerField
                  label="開始月"
                  min={1}
                  max={12}
                  optionSuffix="月"
                  value={draft.startMonth}
                  error={errors[`startMonth-${i}`]}
                  onChange={(startMonth) => commitInterval(i, { startMonth })}
                />
              </Group>
              <Group grow preventGrowOverflow={false} wrap="wrap">
                <IntPickerField
                  label="終了年"
                  min={FIELD_RANGES.birthYear.min}
                  max={FIELD_RANGES.receiptYear.max}
                  optionSuffix="年"
                  value={draft.endYear}
                  error={errors[`endYear-${i}`]}
                  onChange={(endYear) => commitInterval(i, { endYear })}
                />
                <IntPickerField
                  label="終了月"
                  min={1}
                  max={12}
                  optionSuffix="月"
                  value={draft.endMonth}
                  error={errors[`endMonth-${i}`]}
                  onChange={(endMonth) => commitInterval(i, { endMonth })}
                />
              </Group>
            </Stack>
          ))}
          <Button
            type="button"
            variant="default"
            onClick={() => {
              const startYear = birth ? Math.max(birth.year, benefit.receiptYear - 10) : benefit.receiptYear - 10;
              onChange({
                intervals: [
                  ...(benefit.intervals ?? []),
                  {
                    start: { year: startYear, month: 1 },
                    end: { year: benefit.receiptYear, month: 12 },
                  },
                ],
              });
            }}
          >
            区間を追加
          </Button>
          </Stack>
        ) : (
          <IntPickerField
            label="勤続年数"
            min={FIELD_RANGES.serviceYears.min}
            max={FIELD_RANGES.serviceYears.max}
            optionSuffix="年"
            value={serviceRaw}
            error={errors.service}
            onChange={commitService}
          />
        )}
        {benefit.kind === "dc" ? (
          <Stack gap={6}>
            <IntPickerField
              label="拠出終了年齢（任意）"
              min={endBounds.min}
              max={Math.max(endBounds.min, endBounds.max)}
              optionSuffix="歳"
              value={endAgeRaw}
              error={errors.endAge}
              disabled={endBounds.max < endBounds.min}
              onChange={(raw) => {
                setEndAgeRaw(raw);
                if (raw.trim() === "") {
                  onChange({ contributionEndAge: undefined });
                  return;
                }
                const parsed = parseContributionEndAge(raw, receiptAge);
                if (parsed.ok) onChange({ contributionEndAge: parsed.value });
              }}
            />
            <Text size="sm" c="var(--ink-muted)">
              {CONTRIBUTION_END_NOTE}
              {receiptAge !== null ? ` いまの受取年齢は${receiptAge}歳です。` : ""}
            </Text>
          </Stack>
        ) : null}
        {canOptimize ? (
          <Checkbox
            label="受取年を探索する（iDeCo は 60歳から75歳）"
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
          label="勤続期間を年月で入れる"
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
      </Stack>
    </Paper>
  );
}
