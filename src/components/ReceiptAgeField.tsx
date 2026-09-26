"use client";

import { Text } from "@mantine/core";
import type { BenefitKind } from "@/engine";
import { IntPickerField } from "./IntPickerField";
import { DEFAULT_RECEIPT_AGE, FIELD_RANGES, receiptAgeRange } from "@/lib/field-ranges";
import { receiptYearFromAge } from "@/lib/field-validation";

type Props = {
  value: string;
  birthYear: number | null;
  onChange: (raw: string) => void;
  error?: string;
  kind?: BenefitKind;
  serviceYears?: number;
  membershipMonths?: number;
  label?: string;
};

export function ReceiptAgeField({
  value,
  birthYear,
  onChange,
  error,
  kind = "company",
  serviceYears = 10,
  membershipMonths,
  label = "受取年齢",
}: Props) {
  const range =
    birthYear === null
      ? { min: kind === "dc" ? 60 : 20, max: FIELD_RANGES.receiptYear.max - FIELD_RANGES.birthYear.min }
      : receiptAgeRange(birthYear, kind, serviceYears, membershipMonths);
  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const year =
    birthYear !== null && parsed !== null && parsed >= range.min && parsed <= range.max
      ? receiptYearFromAge(birthYear, parsed)
      : null;
  const firstCandidate = Math.max(range.min, Math.min(range.max, DEFAULT_RECEIPT_AGE));

  return (
    <div>
      <IntPickerField
        label={label}
        value={value}
        min={range.min}
        max={range.max}
        optionSuffix="歳"
        disabled={birthYear === null}
        error={error}
        pickerCenter={firstCandidate}
        windowAlign="start"
        onChange={onChange}
      />
      {birthYear === null ? (
        <Text size="sm" mt={6} c="var(--ink-muted)">
          生年月を先に選ぶと、受取年が出ます。
        </Text>
      ) : year !== null ? (
        <Text size="sm" mt={6} className="derived-year">
          受取年は {year}年です。その年に{parsed}歳の誕生日を迎える暦年です。
        </Text>
      ) : null}
      {kind === "dc" ? (
        <Text size="sm" mt={6} c="var(--ink-muted)">
          {range.min > 60
            ? `加入年数が短いため、${range.min}歳から${range.max}歳です。60歳未満は出せません。`
            : `60歳から${range.max}歳です。60歳未満は出せません。`}
        </Text>
      ) : (
        <Text size="sm" mt={6} c="var(--ink-muted)">
          下限は20歳です。開いたときの先頭は60歳です。60歳より前は、数字を入れると候補に出ます。
        </Text>
      )}
    </div>
  );
}
