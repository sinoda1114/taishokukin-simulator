import {
  ageInCalendarYear,
  serviceYearsFromMonths,
  totalMonths,
  yearOfAge,
  type BenefitInput,
  type SimulationInput,
} from "@/engine";
import { DEFAULT_RECEIPT_AGE, EARLIEST_RETIREMENT_AGE } from "./field-ranges";
import {
  parseBirthYear,
  parseIncomeYen,
  parseMonth,
  parseReceiptAge,
  parseServiceYears,
  receiptYearFromAge,
  serviceConflictsWithReceipt,
} from "./field-validation";
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
};

export type HearingDraft = {
  birthYear: string;
  birthMonth: string;
  companyIncomeYen: string;
  companyServiceYears: string;
  companyReceiptAge: string;
  hasDc: boolean;
  dcIncomeYen: string;
  dcServiceYears: string;
  dcReceiptAge: string;
  hasExtra: boolean;
  goal: HearingGoal;
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
  };
}

export function inputFromAnswers(
  answers: HearingAnswers,
  previous: SimulationInput = defaultInput,
): SimulationInput {
  const birth = { year: answers.birthYear, month: answers.birthMonth };
  const companyYear = yearOfAge(birth, answers.companyReceiptAge);
  const dcYear = yearOfAge(birth, answers.dcReceiptAge);
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
      receiptYear: companyYear,
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
          receiptYear: dcYear,
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

type TripletOk = { ok: true; income: number; service: number; age: number };
type TripletErr = { ok: false; errors: Record<string, string> };

function parseTriplet(
  raw: { income: string; service: string; age: string },
  keys: { income: string; service: string; age: string },
  birthYear: number | null,
  serviceLabel: string,
  kind: "company" | "dc",
  membershipMonths?: number,
): TripletOk | TripletErr {
  const income = parseIncomeYen(raw.income);
  const service = parseServiceYears(raw.service, serviceLabel);
  const age = parseReceiptAge(raw.age, birthYear, {
    kind,
    serviceYears: service.ok ? service.value : undefined,
    membershipMonths: service.ok ? membershipMonths : undefined,
  });
  const errors: Record<string, string> = {};
  if (!income.ok) errors[keys.income] = income.error;
  if (!service.ok) errors[keys.service] = service.error;
  if (!age.ok) errors[keys.age] = age.error;
  if (!income.ok || !service.ok || !age.ok) return { ok: false, errors };
  return { ok: true, income: income.value, service: service.value, age: age.value };
}

function keptMembershipMonths(benefit: BenefitInput | undefined, serviceRaw: string): number | undefined {
  const service = parseServiceYears(serviceRaw, "年数");
  if (!service.ok || !benefit?.intervals || benefit.intervals.length === 0) return undefined;
  if (!keepsDetailedIntervals(benefit, service.value)) return undefined;
  return totalMonths(benefit.intervals);
}

export function hearingGoalChange(
  draft: HearingDraft,
  goal: HearingGoal,
  companyAgeBeforeShared: string | null,
): { draft: HearingDraft; companyAgeBeforeShared: string | null } {
  if (goal === "simultaneous") {
    return {
      draft: { ...draft, goal, companyReceiptAge: draft.dcReceiptAge },
      companyAgeBeforeShared:
        draft.goal === "simultaneous" ? companyAgeBeforeShared : draft.companyReceiptAge,
    };
  }
  return {
    draft: {
      ...draft,
      goal,
      companyReceiptAge: companyAgeBeforeShared ?? draft.companyReceiptAge,
    },
    companyAgeBeforeShared: null,
  };
}

function tenureConflict(
  serviceYears: number,
  receiptAge: number,
  birthYear: number,
  birthMonth: number | null,
): string | null {
  if (birthMonth === null) return null;
  return serviceConflictsWithReceipt(serviceYears, receiptYearFromAge(birthYear, receiptAge), {
    year: birthYear,
    month: birthMonth,
  });
}

export type HearingParse =
  | { ok: true; value: HearingAnswers }
  | { ok: false; errors: Record<string, string> };

/** ヒアリングの検証はここだけ。同時受取は、画面の DC 年齢を会社と DC の両方に使う。 */
export function parseDraft(draft: HearingDraft, previousBenefits: BenefitInput[] = []): HearingParse {
  const nextErrors: Record<string, string> = {};
  const birthY = parseBirthYear(draft.birthYear);
  const birthM = parseMonth(draft.birthMonth, "生月");
  if (!birthY.ok) nextErrors.birthYear = birthY.error;
  if (!birthM.ok) nextErrors.birthMonth = birthM.error;
  const prevCompany = firstOfKind(previousBenefits, "company");
  const prevDc = firstOfKind(previousBenefits, "dc");
  const company = parseTriplet(
    {
      income: draft.companyIncomeYen,
      service: draft.companyServiceYears,
      age: draft.companyReceiptAge,
    },
    { income: "companyIncomeYen", service: "companyServiceYears", age: "companyReceiptAge" },
    birthY.ok ? birthY.value : null,
    "勤続年数",
    "company",
  );
  if (!company.ok) Object.assign(nextErrors, company.errors);
  const dcMonths = keptMembershipMonths(prevDc, draft.dcServiceYears);
  const dc = draft.hasDc
    ? parseTriplet(
        { income: draft.dcIncomeYen, service: draft.dcServiceYears, age: draft.dcReceiptAge },
        { income: "dcIncomeYen", service: "dcServiceYears", age: "dcReceiptAge" },
        birthY.ok ? birthY.value : null,
        "拠出年数",
        "dc",
        dcMonths,
      )
    : null;
  if (dc && !dc.ok) Object.assign(nextErrors, dc.errors);

  const shared = Boolean(draft.hasDc && draft.goal === "simultaneous" && dc?.ok);
  const companyAge = shared && dc?.ok ? dc.age : company.ok ? company.age : null;
  const dcAge = dc?.ok ? dc.age : null;
  if (company.ok && companyAge !== null && birthY.ok && !keepsDetailedIntervals(prevCompany, company.service)) {
    const conflict = tenureConflict(company.service, companyAge, birthY.value, birthM.ok ? birthM.value : null);
    if (conflict) nextErrors.companyReceiptAge = conflict;
  }
  if (dc?.ok && dcAge !== null && birthY.ok && !keepsDetailedIntervals(prevDc, dc.service)) {
    const conflict = tenureConflict(dc.service, dcAge, birthY.value, birthM.ok ? birthM.value : null);
    if (conflict) nextErrors.dcReceiptAge = conflict;
  }

  if (Object.keys(nextErrors).length > 0 || !birthY.ok || !birthM.ok || !company.ok) {
    return { ok: false, errors: nextErrors };
  }
  return {
    ok: true,
    value: {
      birthYear: birthY.value,
      birthMonth: birthM.value,
      companyIncomeYen: company.income,
      companyServiceYears: company.service,
      companyReceiptAge: companyAge ?? company.age,
      hasDc: draft.hasDc,
      dcIncomeYen: dc?.ok ? dc.income : 0,
      dcServiceYears: dc?.ok ? dc.service : 1,
      dcReceiptAge: dcAge ?? company.age,
      hasExtra: draft.hasExtra,
      goal: draft.goal,
    },
  };
}

export function hearingStepErrorKeys(
  step: HearingStepId,
  draft: Pick<HearingDraft, "hasDc" | "goal">,
): string[] {
  switch (step) {
    case "birth":
      return ["birthYear", "birthMonth"];
    case "company":
      return ["companyIncomeYen", "companyServiceYears", "companyReceiptAge"];
    case "dc":
      return ["dcIncomeYen", "dcServiceYears", "dcReceiptAge"];
    case "hasDc":
    case "hasExtra":
      return [];
    case "goal":
      return draft.hasDc && draft.goal === "simultaneous" ? ["companyReceiptAge", "dcReceiptAge"] : [];
    default: {
      const unreachable: never = step;
      return unreachable;
    }
  }
}

export function hearingStepForErrors(
  draft: Pick<HearingDraft, "hasDc" | "goal">,
  errors: Record<string, string>,
): HearingStepId {
  const ageError = Boolean(errors.companyReceiptAge || errors.dcReceiptAge);
  const earlier = Boolean(
    errors.birthYear ||
      errors.birthMonth ||
      errors.companyIncomeYen ||
      errors.companyServiceYears ||
      errors.dcIncomeYen ||
      errors.dcServiceYears,
  );
  if (draft.hasDc && draft.goal === "simultaneous" && ageError && !earlier) return "goal";
  if (errors.birthYear || errors.birthMonth) return "birth";
  if (errors.companyIncomeYen || errors.companyServiceYears || errors.companyReceiptAge) return "company";
  if (errors.dcIncomeYen || errors.dcServiceYears || errors.dcReceiptAge) return "dc";
  return "goal";
}
