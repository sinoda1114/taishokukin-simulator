"use client";

import { useMemo, useState } from "react";
import { Select, Text, TextInput } from "@mantine/core";
import { pickerWindow } from "@/lib/picker-window";

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

function option(value: number, suffix?: string): { value: string; label: string } {
  return { value: String(value), label: optionLabel(value, suffix) };
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
  const [opened, setOpened] = useState(false);
  const trimmed = value.trim();
  const selected =
    /^\d+$/.test(trimmed) && Number(trimmed) >= min && Number(trimmed) <= max ? Number(trimmed) : null;

  const data = useMemo(() => {
    if (selected === null && !opened) return [];
    if (!opened) return selected === null ? [] : [option(selected, optionSuffix)];
    const window = pickerWindow(min, max, selected);
    const options: { value: string; label: string }[] = [];
    for (let n = window.min; n <= window.max; n += 1) {
      options.push(option(n, optionSuffix));
    }
    if (selected !== null && (selected < window.min || selected > window.max)) {
      options.unshift(option(selected, optionSuffix));
    }
    return options;
  }, [opened, min, max, optionSuffix, selected]);

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
          value={selected === null ? null : String(selected)}
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
          onDropdownOpen={() => setOpened(true)}
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
