import type { BenefitInput, BenefitKind } from "@/engine";
import { KIND_LABELS } from "@/lib/parse-input";

/** ヒアリングの iDeCo 枠。追加した行は、並びが前でも枠にしない。 */
export function isDedicatedDcSlot(benefit: BenefitInput, benefits: BenefitInput[]): boolean {
  return benefits.find((item) => item.kind === "dc")?.id === benefit.id;
}

export function benefitKindChoices(dedicatedDc: boolean): { value: BenefitKind; label: string }[] {
  return (Object.keys(KIND_LABELS) as BenefitKind[])
    .filter((kind) => kind !== "dc" || dedicatedDc)
    .map((value) => ({ value, label: KIND_LABELS[value] }));
}
