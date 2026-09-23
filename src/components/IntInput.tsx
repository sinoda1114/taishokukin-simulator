"use client";

import { NumberInput, type NumberInputProps } from "@mantine/core";
import { toInt } from "@/lib/ui-numbers";

type Props = Omit<
  NumberInputProps,
  "onChange" | "allowDecimal" | "allowNegative" | "hideControls" | "decimalSeparator" | "allowedDecimalSeparators"
> & {
  onValue: (value: number) => void;
  onEmpty?: () => void;
  emptyValue?: number;
};

export function IntInput({ onValue, onEmpty, emptyValue = 0, ...rest }: Props) {
  return (
    <NumberInput
      hideControls
      allowDecimal={false}
      allowNegative={false}
      decimalSeparator="."
      allowedDecimalSeparators={["."]}
      clampBehavior="none"
      onChange={(value) => {
        if (value === "" && onEmpty) {
          onEmpty();
          return;
        }
        onValue(toInt(value, emptyValue));
      }}
      {...rest}
    />
  );
}
