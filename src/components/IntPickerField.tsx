"use client";

import { useMemo, useState } from "react";
import { Select, Text } from "@mantine/core";
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
  pickerCenter?: number;
};

function optionLabel(value: number, suffix?: string): string {
  return suffix ? `${value}${suffix}` : String(value);
}

function option(value: number, suffix?: string): { value: string; label: string } {
  return { value: String(value), label: optionLabel(value, suffix) };
}

export function IntPickerField({
  label,
  value,
  min,
  max,
  onChange,
  error,
  disabled,
  optionSuffix,
  pickerCenter,
}: Props) {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = value.trim();
  const selected =
    /^\d+$/.test(trimmed) && Number(trimmed) >= min && Number(trimmed) <= max ? Number(trimmed) : null;
  const typed = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;

  const data = useMemo(() => {
    if (!opened) return selected === null ? [] : [option(selected, optionSuffix)];
    const center = selected ?? typed ?? pickerCenter ?? Math.round((min + max) / 2);
    const window = pickerWindow(min, max, center);
    const options: { value: string; label: string }[] = [];
    for (let n = window.min; n <= window.max; n += 1) {
      options.push(option(n, optionSuffix));
    }
    return options;
  }, [opened, min, max, optionSuffix, selected, typed, pickerCenter]);

  return (
    <div className="picker-field">
      <Select
        label={label}
        data={data}
        value={selected === null ? null : String(selected)}
        searchable
        clearable
        disabled={disabled}
        aria-invalid={Boolean(error)}
        clearButtonProps={{ "aria-label": `${label}を消す` }}
        nothingFoundMessage="該当する値がありません"
        maxDropdownHeight={240}
        comboboxProps={{
          withinPortal: true,
          position: "bottom-start",
          middlewares: { flip: true, shift: true },
        }}
        onDropdownOpen={() => setOpened(true)}
        onSearchChange={setQuery}
        onChange={(next) => onChange(next ?? "")}
      />
      {error ? (
        <Text className="field-error" size="sm" mt={6} role="alert">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
