"use client";

import { Text } from "@mantine/core";
import type { BenefitKind } from "@/engine";
import { IntPickerField } from "./IntPickerField";
import { clampReceiptAge, DEFAULT_RECEIPT_AGE, FIELD_RANGES, RECEIPT_AGE_MIN, receiptAgeRange } from "@/lib/field-ranges";
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
      ? { min: RECEIPT_AGE_MIN, max: FIELD_RANGES.receiptYear.max - FIELD_RANGES.birthYear.min }
      : receiptAgeRange(birthYear, kind, serviceYears, membershipMonths);
  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const year =
    birthYear !== null && parsed !== null && parsed >= range.min && parsed <= range.max
      ? receiptYearFromAge(birthYear, parsed)
      : null;
  const firstCandidate = clampReceiptAge(range, DEFAULT_RECEIPT_AGE) ?? range.min;

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
      <Text size="sm" mt={6} c="var(--ink-muted)">
        {kind === "dc" && range.min > RECEIPT_AGE_MIN
          ? `加入年数が短いため、${range.min}歳から${range.max}歳です。60歳未満は出せません。`
          : `${range.min}歳から${range.max}歳です。60歳未満は出せません。`}
      </Text>
    </div>
  );
}
