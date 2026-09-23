"use client";

import { useMemo } from "react";
import { Select, Text, TextInput } from "@mantine/core";

type Props = {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (raw: string) => void;
  error?: string;
  disabled?: boolean;
  optionSuffix?: string;
  pickerLabel?: string;
};

function optionLabel(value: number, suffix?: string): string {
  return suffix ? `${value}${suffix}` : String(value);
}

export function DualIntField({
  label,
  value,
  min,
  max,
  onChange,
  error,
  disabled,
  optionSuffix,
  pickerLabel,
}: Props) {
  const data = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let n = min; n <= max; n += 1) {
      options.push({ value: String(n), label: optionLabel(n, optionSuffix) });
    }
    return options;
  }, [min, max, optionSuffix]);

  const trimmed = value.trim();
  const selected = /^\d+$/.test(trimmed) && Number(trimmed) >= min && Number(trimmed) <= max ? trimmed : null;

  return (
    <div className="dual-field">
      <Text size="sm" fw={600} mb={6}>
        {label}
      </Text>
      <div className="dual-pair">
        <TextInput
          aria-label={label}
          value={value}
          inputMode="numeric"
          aria-invalid={Boolean(error)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <Select
          aria-label={pickerLabel ?? `${label}の選択`}
          data={data}
          value={selected}
          searchable
          allowDeselect={false}
          disabled={disabled}
          nothingFoundMessage="見つかりません"
          maxDropdownHeight={240}
          comboboxProps={{
            withinPortal: true,
            position: "bottom-start",
            middlewares: { flip: true, shift: true },
          }}
          onChange={(next) => {
            if (next) onChange(next);
          }}
        />
      </div>
      {error ? (
        <Text className="field-error" size="sm" mt={6} role="alert">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
