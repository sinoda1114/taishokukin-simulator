import type { BenefitInput, SimulationInput } from "@/engine";
import { defaultInput } from "./default-input";

export type HearingGoal = "simultaneous" | "sequence";

export type HearingAnswers = {
  birthYear: number;
  birthMonth: number;
  companyIncomeYen: number;
  companyServiceYears: number;
  companyReceiptYear: number;
  hasDc: boolean;
  dcIncomeYen: number;
  dcServiceYears: number;
  dcReceiptYear: number;
  hasExtra: boolean;
  goal: HearingGoal;
};

export type HearingStepId = "birth" | "company" | "hasDc" | "dc" | "hasExtra" | "goal";

const STEP_ORDER: HearingStepId[] = ["birth", "company", "hasDc", "dc", "hasExtra", "goal"];

export function visibleHearingSteps(hasDc: boolean): HearingStepId[] {
  return STEP_ORDER.filter((step) => step !== "dc" || hasDc);
}

export function nextHearingStep(
  current: HearingStepId,
  hasDc: boolean,
): HearingStepId | "done" {
  const steps = visibleHearingSteps(hasDc);
  const index = steps.indexOf(current);
  if (index < 0 || index >= steps.length - 1) return "done";
  return steps[index + 1] ?? "done";
}

export function prevHearingStep(current: HearingStepId, hasDc: boolean): HearingStepId | null {
  const steps = visibleHearingSteps(hasDc);
  const index = steps.indexOf(current);
  if (index <= 0) return null;
  return steps[index - 1] ?? null;
}

export function answersFromInput(input: SimulationInput): HearingAnswers {
  const company = input.benefits.find((b) => b.kind === "company");
  const dc = input.benefits.find((b) => b.kind === "dc");
  const extra = input.benefits.find((b) => b.kind !== "company" && b.kind !== "dc");
  const sampleCompany = defaultInput.benefits[0];
  const sampleDc = defaultInput.benefits[1];
  return {
    birthYear: input.birthYearMonth?.year ?? 1965,
    birthMonth: input.birthYearMonth?.month ?? 4,
    companyIncomeYen: company?.incomeYen ?? sampleCompany?.incomeYen ?? 0,
    companyServiceYears: company?.serviceYears ?? sampleCompany?.serviceYears ?? 1,
    companyReceiptYear: company?.receiptYear ?? sampleCompany?.receiptYear ?? 2030,
    hasDc: Boolean(dc),
    dcIncomeYen: dc?.incomeYen ?? sampleDc?.incomeYen ?? 0,
    dcServiceYears: dc?.serviceYears ?? sampleDc?.serviceYears ?? 1,
    dcReceiptYear: dc?.receiptYear ?? sampleDc?.receiptYear ?? 2030,
    hasExtra: Boolean(extra),
    goal: dc?.optimizeReceiptYear ? "sequence" : "simultaneous",
  };
}

export function inputFromAnswers(answers: HearingAnswers): SimulationInput {
  const benefits: BenefitInput[] = [
    {
      id: "company",
      kind: "company",
      incomeYen: answers.companyIncomeYen,
      serviceYears: Math.max(1, answers.companyServiceYears),
      receiptYear: answers.companyReceiptYear,
    },
  ];
  if (answers.hasDc) {
    const receiptYear =
      answers.goal === "simultaneous" ? answers.companyReceiptYear : answers.dcReceiptYear;
    benefits.push({
      id: "dc",
      kind: "dc",
      incomeYen: answers.dcIncomeYen,
      serviceYears: Math.max(1, answers.dcServiceYears),
      receiptYear,
      optimizeReceiptYear: answers.goal === "sequence",
    });
  }
  if (answers.hasExtra) {
    benefits.push({
      id: "extra",
      kind: "other",
      incomeYen: 0,
      serviceYears: 20,
      receiptYear: answers.companyReceiptYear,
    });
  }
  return {
    schemaVersion: 1,
    birthYearMonth: { year: answers.birthYear, month: answers.birthMonth },
    ruleMode: "auto",
    benefits,
  };
}
