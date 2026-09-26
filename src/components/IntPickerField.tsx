"use client";

import { useMemo, useRef, useState } from "react";
import { CloseButton, Combobox, Select, Text } from "@mantine/core";
import { digitsFromPickerSearch, prefixCenter } from "@/lib/picker-search";
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
  windowAlign?: "center" | "start";
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
  windowAlign = "center",
}: Props) {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState("");
  const pickedRef = useRef(false);
  const trimmed = value.trim();
  const selected =
    /^\d+$/.test(trimmed) && Number(trimmed) >= min && Number(trimmed) <= max ? Number(trimmed) : null;
  const selectedLabel = selected === null ? null : optionLabel(selected, optionSuffix);
  const typedDigits = digitsFromPickerSearch(query, selectedLabel);

  const data = useMemo(() => {
    if (!opened) return selected === null ? [] : [option(selected, optionSuffix)];
    const fallback = selected ?? pickerCenter ?? Math.round((min + max) / 2);
    const center = prefixCenter(typedDigits, min, max, fallback);
    const align = typedDigits ? "center" : windowAlign;
    const anchor = typedDigits ? center : (pickerCenter ?? center);
    const window = pickerWindow(min, max, anchor, align);
    const options: { value: string; label: string }[] = [];
    for (let n = window.min; n <= window.max; n += 1) {
      options.push(option(n, optionSuffix));
    }
    if (selected !== null && (selected < window.min || selected > window.max)) {
      options.push(option(selected, optionSuffix));
    }
    return options;
  }, [opened, min, max, optionSuffix, selected, typedDigits, pickerCenter, windowAlign]);

  return (
    <div className="picker-field">
      <Select
        label={label}
        data={data}
        value={selected === null ? null : String(selected)}
        searchable
        allowDeselect={false}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        nothingFoundMessage="該当する値がありません"
        maxDropdownHeight={240}
        searchValue={opened ? query : undefined}
        selectFirstOptionOnChange={typedDigits.length > 0}
        autoSelectOnBlur
        filter={({ options, search }) => {
          const digits = digitsFromPickerSearch(search, selectedLabel);
          if (!digits) return options;
          return options.filter((item) => "value" in item && item.value.startsWith(digits));
        }}
        rightSection={
          <span className="picker-field-actions">
            {selected !== null && !disabled ? (
              <CloseButton
                aria-label={`${label}を消す`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange("")}
              />
            ) : null}
            <Combobox.Chevron />
          </span>
        }
        rightSectionWidth={selected !== null && !disabled ? 56 : 28}
        comboboxProps={{
          withinPortal: true,
          position: "bottom-start",
          middlewares: { flip: true, shift: true },
        }}
        onDropdownOpen={() => {
          pickedRef.current = false;
          setOpened(true);
          setQuery("");
        }}
        onDropdownClose={() => {
          if (!pickedRef.current) {
            const typed = Number(typedDigits);
            if (typedDigits !== "" && Number.isInteger(typed) && typed >= min && typed <= max) {
              onChange(String(typed));
            }
          }
          pickedRef.current = false;
          setOpened(false);
          setQuery("");
        }}
        onSearchChange={(raw) => setQuery(digitsFromPickerSearch(raw, selectedLabel))}
        onOptionSubmit={() => {
          pickedRef.current = true;
        }}
        onChange={(next) => {
          pickedRef.current = true;
          onChange(next ?? "");
        }}
      />
      {error ? (
        <Text className="field-error" size="sm" mt={6} role="alert">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
