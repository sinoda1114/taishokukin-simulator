import {
  ageInCalendarYear,
  serviceYearsFromMonths,
  totalMonths,
  yearOfAge,
  type BenefitInput,
  type SimulationInput,
} from "@/engine";
import { DEFAULT_RECEIPT_AGE, EARLIEST_RETIREMENT_AGE } from "./field-ranges";
import { defaultInput } from "./default-input";

export type HearingGoal = "simultaneous" | "sequence";

export type HearingAnswers = {
  birthYear: number;
  birthMonth: number;
  companyIncomeYen: number;
  companyServiceYears: number;
  companyReceiptAge: number;
  hasDc: boolean;
  dcIncomeYen: number;
  dcServiceYears: number;
  dcReceiptAge: number;
  hasExtra: boolean;
  goal: HearingGoal;
  /** 同時受取で、結果へ進む前に画面へ出した共通の年齢。未指定なら DC の年齢は変えない。 */
  simultaneousAge?: number;
};

export type HearingStepId = "birth" | "company" | "hasDc" | "dc" | "hasExtra" | "goal";

const STEP_ORDER: HearingStepId[] = ["birth", "company", "hasDc", "dc", "hasExtra", "goal"];
const MAX_BENEFITS = 6;
const sampleCompany = defaultInput.benefits[0];
const sampleDc = defaultInput.benefits[1];

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

function firstOfKind(benefits: BenefitInput[], kind: BenefitInput["kind"]): BenefitInput | undefined {
  return benefits.find((benefit) => benefit.kind === kind);
}

function isPrimary(benefit: BenefitInput, company?: BenefitInput, dc?: BenefitInput): boolean {
  return benefit.id === company?.id || benefit.id === dc?.id;
}

export function detailedServiceYears(benefit: BenefitInput | undefined): number | null {
  if (!benefit?.intervals || benefit.intervals.length === 0) return null;
  return serviceYearsFromMonths(totalMonths(benefit.intervals));
}

export function keepsDetailedIntervals(
  benefit: BenefitInput | undefined,
  serviceYears: number,
): boolean {
  const detailed = detailedServiceYears(benefit);
  return detailed !== null && detailed === serviceYears;
}

function shownServiceYears(benefit: BenefitInput | undefined, fallback: number): number {
  return detailedServiceYears(benefit) ?? benefit?.serviceYears ?? fallback;
}

function patchBenefit(
  benefit: BenefitInput | undefined,
  patch: BenefitInput,
  keepIntervals: boolean,
): BenefitInput {
  if (!benefit) return patch;
  if (keepIntervals && benefit.intervals && benefit.intervals.length > 0) {
    return { ...benefit, ...patch, id: benefit.id, intervals: benefit.intervals };
  }
  const { intervals: _drop, ...rest } = benefit;
  return { ...rest, ...patch, id: benefit.id };
}

function unusedReceiptYear(benefits: BenefitInput[], birthYear: number): number {
  const used = new Set(benefits.map((benefit) => benefit.receiptYear));
  const first = Math.max(1980, birthYear + EARLIEST_RETIREMENT_AGE);
  for (let year = first; year <= 2200; year += 1) {
    if (!used.has(year)) return year;
  }
  return 2200;
}

export function answersFromInput(input: SimulationInput): HearingAnswers {
  const company = firstOfKind(input.benefits, "company");
  const dc = firstOfKind(input.benefits, "dc");
  const extra = input.benefits.some((benefit) => !isPrimary(benefit, company, dc));
  const yearsDiffer = Boolean(dc && company && dc.receiptYear !== company.receiptYear);
  const birth = input.birthYearMonth ?? defaultInput.birthYearMonth ?? { year: 1965, month: 4 };
  return {
    birthYear: birth.year,
    birthMonth: birth.month,
    companyIncomeYen: company?.incomeYen ?? sampleCompany?.incomeYen ?? 0,
    companyServiceYears: shownServiceYears(company, sampleCompany?.serviceYears ?? 1),
    companyReceiptAge: company ? ageInCalendarYear(birth, company.receiptYear) : DEFAULT_RECEIPT_AGE,
    hasDc: Boolean(dc),
    dcIncomeYen: dc?.incomeYen ?? sampleDc?.incomeYen ?? 0,
    dcServiceYears: shownServiceYears(dc, sampleDc?.serviceYears ?? 1),
    dcReceiptAge: dc ? ageInCalendarYear(birth, dc.receiptYear) : DEFAULT_RECEIPT_AGE,
    hasExtra: extra,
    goal: dc?.optimizeReceiptYear || yearsDiffer ? "sequence" : "simultaneous",
    simultaneousAge:
      dc && company && dc.receiptYear === company.receiptYear
        ? ageInCalendarYear(birth, dc.receiptYear)
        : dc
          ? ageInCalendarYear(birth, dc.receiptYear)
          : undefined,
  };
}

export function inputFromAnswers(
  answers: HearingAnswers,
  previous: SimulationInput = defaultInput,
): SimulationInput {
  const birth = { year: answers.birthYear, month: answers.birthMonth };
  const companyYear = yearOfAge(birth, answers.companyReceiptAge);
  const dcYear = yearOfAge(birth, answers.dcReceiptAge);
  const sharedYear =
    answers.hasDc && answers.goal === "simultaneous" && answers.simultaneousAge !== undefined
      ? yearOfAge(birth, answers.simultaneousAge)
      : null;
  const previousBenefits = previous.benefits;
  const prevCompany = firstOfKind(previousBenefits, "company");
  const prevDc = firstOfKind(previousBenefits, "dc");
  const company = patchBenefit(
    prevCompany,
    {
      id: prevCompany?.id ?? "company",
      kind: "company",
      incomeYen: answers.companyIncomeYen,
      serviceYears: Math.max(1, answers.companyServiceYears),
      receiptYear: sharedYear ?? companyYear,
    },
    keepsDetailedIntervals(prevCompany, answers.companyServiceYears),
  );
  const dc = answers.hasDc
    ? patchBenefit(
        prevDc,
        {
          id: prevDc?.id ?? "dc",
          kind: "dc",
          incomeYen: answers.dcIncomeYen,
          serviceYears: Math.max(1, answers.dcServiceYears),
          receiptYear: sharedYear ?? dcYear,
          optimizeReceiptYear: answers.goal === "sequence",
        },
        keepsDetailedIntervals(prevDc, answers.dcServiceYears),
      )
    : undefined;

  const kept: BenefitInput[] = [company];
  if (dc) kept.push(dc);
  for (const benefit of previousBenefits) {
    if (isPrimary(benefit, prevCompany, prevDc)) continue;
    if (!answers.hasExtra) continue;
    if (kept.length >= MAX_BENEFITS) break;
    kept.push({ ...benefit });
  }
  if (answers.hasExtra && kept.length === (dc ? 2 : 1) && kept.length < MAX_BENEFITS) {
    kept.push({
      id: "extra",
      kind: "other",
      incomeYen: 0,
      serviceYears: 20,
      receiptYear: unusedReceiptYear(kept, answers.birthYear),
    });
  }

  return {
    ...previous,
    birthYearMonth: { year: answers.birthYear, month: answers.birthMonth },
    benefits: kept,
  };
}
