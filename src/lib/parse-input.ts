import { z } from "zod";
import type { BenefitKind, RuleMode, SimulationInput } from "@/engine";

const yearMonthSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
});

const intervalSchema = z.object({
  start: yearMonthSchema,
  end: yearMonthSchema,
});

const kindSchema = z.enum(["company", "dc", "mutual_aid", "other"]);
const ruleModeSchema = z.enum(["auto", "pre_2026", "post_2026"]);

const benefitSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: kindSchema,
    label: z.string().max(80).optional(),
    incomeYen: z.number().int().min(0).max(10_000_000_000),
    intervals: z.array(intervalSchema).max(12).optional(),
    serviceYears: z.number().int().min(1).max(80).optional(),
    receiptYear: z.number().int().min(1980).max(2200),
    optimizeReceiptYear: z.boolean().optional(),
    contributionEndAge: z.number().int().min(50).max(75).optional(),
    disability: z.boolean().optional(),
  })
  .refine(
    (b) => (b.intervals && b.intervals.length > 0) || b.serviceYears !== undefined,
    { message: "勤続期間か勤続年数のどちらかが必要です" },
  );

export const simulationInputSchema = z.object({
  schemaVersion: z.literal(1),
  birthYearMonth: yearMonthSchema.optional(),
  ruleMode: ruleModeSchema,
  benefits: z.array(benefitSchema).min(1).max(6),
});

export function parseSimulationInput(raw: unknown): SimulationInput {
  return simulationInputSchema.parse(raw);
}

export const KIND_LABELS: Record<BenefitKind, string> = {
  company: "会社退職金",
  dc: "iDeCo・企業型DC一時金",
  mutual_aid: "小規模企業共済",
  other: "その他",
};

export const RULE_MODE_LABELS: Record<RuleMode, string> = {
  auto: "受取年で自動",
  pre_2026: "改正前固定（4年）",
  post_2026: "改正後固定（9年）",
};

export function formatYen(yen: number | null): string {
  if (yen === null) return "—";
  return `${yen.toLocaleString("ja-JP")}円`;
}
