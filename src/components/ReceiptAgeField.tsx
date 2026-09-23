"use client";

import { Text } from "@mantine/core";
import { DualIntField } from "./DualIntField";
import { FIELD_RANGES, receiptAgeRange } from "@/lib/field-ranges";
import { receiptYearFromAge } from "@/lib/field-validation";

type Props = {
  value: string;
  birthYear: number | null;
  onChange: (raw: string) => void;
  error?: string;
};

export function ReceiptAgeField({ value, birthYear, onChange, error }: Props) {
  const range =
    birthYear === null
      ? { min: 0, max: FIELD_RANGES.receiptYear.max - FIELD_RANGES.birthYear.min }
      : receiptAgeRange(birthYear);
  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const year =
    birthYear !== null && parsed !== null && parsed >= range.min && parsed <= range.max
      ? receiptYearFromAge(birthYear, parsed)
      : null;

  return (
    <div>
      <DualIntField
        label="受取年齢"
        value={value}
        min={range.min}
        max={range.max}
        optionSuffix="歳"
        disabled={birthYear === null}
        error={error}
        onChange={onChange}
      />
      {birthYear === null ? (
        <Text size="sm" mt={6} c="var(--ink-muted)">
          生年月を先に入れると、受取年が出ます。
        </Text>
      ) : year !== null ? (
        <Text size="sm" mt={6} className="derived-year">
          受取年は {year}年です。その年に{parsed}歳の誕生日を迎える暦年です。
        </Text>
      ) : null}
    </div>
  );
}
