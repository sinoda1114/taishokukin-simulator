import {
  ageInCalendarYear,
  serviceYearsFromMonths,
  totalMonths,
  yearOfAge,
  type BenefitInput,
  type SimulationInput,
} from "@/engine";
import {
  birthYearReceiptError,
  DEFAULT_RECEIPT_AGE,
  generalReceiptAgeRange,
  receiptAgeRange,
  receiptYearAfterBirthChange,
} from "./field-ranges";
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

export type HearingSlot = {
  incomeYen: number;
  serviceYears: number;
  receiptAge: number;
};

export type HearingAnswers = {
  birthYear: number;
  birthMonth: number;
  company: HearingSlot | null;
  dc: HearingSlot | null;
  hasExtra: boolean;
  goal: HearingGoal;
};

export type HearingDraft = {
  birthYear: string;
  birthMonth: string;
  hasCompany: boolean;
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

export type HearingStepId = "birth" | "hasCompany" | "company" | "hasDc" | "dc" | "hasExtra" | "goal";

export type HearingFlags = { hasCompany: boolean; hasDc: boolean };

const STEP_ORDER: HearingStepId[] = ["birth", "hasCompany", "company", "hasDc", "dc", "hasExtra", "goal"];
const MAX_BENEFITS = 6;
const sampleCompany = defaultInput.benefits[0];
const sampleDc = defaultInput.benefits[1];

export function visibleHearingSteps(flags: HearingFlags): HearingStepId[] {
  return STEP_ORDER.filter((step) => {
    if (step === "company") return flags.hasCompany;
    if (step === "dc") return flags.hasDc;
    if (step === "goal") return flags.hasCompany && flags.hasDc;
    return true;
  });
}

export function nextHearingStep(
  current: HearingStepId,
  flags: HearingFlags,
): HearingStepId | "done" {
  const steps = visibleHearingSteps(flags);
  const index = steps.indexOf(current);
  if (index < 0 || index >= steps.length - 1) return "done";
  return steps[index + 1] ?? "done";
}

export function prevHearingStep(current: HearingStepId, flags: HearingFlags): HearingStepId | null {
  const steps = visibleHearingSteps(flags);
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

function unusedReceiptYear(benefits: BenefitInput[], birthYear: number): number | null {
  const range = generalReceiptAgeRange(birthYear);
  if (range.min > range.max) return null;
  const used = new Set(benefits.map((benefit) => benefit.receiptYear));
  const first = birthYear + range.min;
  const last = birthYear + range.max;
  for (let year = first; year <= last; year += 1) {
    if (!used.has(year)) return year;
  }
  return null;
}

function alignedExtraReceiptYear(
  benefit: BenefitInput,
  previousBirthYear: number,
  nextBirthYear: number,
): number {
  return receiptYearAfterBirthChange(benefit, previousBirthYear, nextBirthYear);
}

function hearingBirth(input: SimulationInput): { year: number; month: number } {
  return input.birthYearMonth ?? defaultInput.birthYearMonth ?? { year: 1965, month: 4 };
}

function kindHasSlot(kind: BenefitInput["kind"], answers: HearingAnswers): boolean {
  if (kind === "company") return answers.company !== null;
  if (kind === "dc") return answers.dc !== null;
  return true;
}

export function answersFromInput(input: SimulationInput): HearingAnswers {
  const company = firstOfKind(input.benefits, "company");
  const dc = firstOfKind(input.benefits, "dc");
  const extra = input.benefits.some((benefit) => !isPrimary(benefit, company, dc));
  const yearsDiffer = Boolean(dc && company && dc.receiptYear !== company.receiptYear);
  const birth = hearingBirth(input);
  return {
    birthYear: birth.year,
    birthMonth: birth.month,
    company: company
      ? {
          incomeYen: company.incomeYen,
          serviceYears: shownServiceYears(company, sampleCompany?.serviceYears ?? 1),
          receiptAge: ageInCalendarYear(birth, company.receiptYear),
        }
      : null,
    dc: dc
      ? {
          incomeYen: dc.incomeYen,
          serviceYears: shownServiceYears(dc, sampleDc?.serviceYears ?? 1),
          receiptAge: ageInCalendarYear(birth, dc.receiptYear),
        }
      : null,
    hasExtra: extra,
    goal: dc?.optimizeReceiptYear || yearsDiffer ? "sequence" : "simultaneous",
  };
}

function slotDraft(
  slot: HearingSlot | null,
  sample: BenefitInput | undefined,
): { income: string; service: string; age: string } {
  if (slot) {
    return {
      income: String(slot.incomeYen),
      service: String(slot.serviceYears),
      age: String(slot.receiptAge),
    };
  }
  return {
    income: sample ? String(sample.incomeYen) : "",
    service: sample?.serviceYears === undefined ? "" : String(sample.serviceYears),
    age: String(DEFAULT_RECEIPT_AGE),
  };
}

export function hearingDraft(input: SimulationInput): HearingDraft {
  const answers = answersFromInput(input);
  const company = slotDraft(answers.company, sampleCompany);
  const dc = slotDraft(answers.dc, sampleDc);
  return {
    birthYear: String(answers.birthYear),
    birthMonth: String(answers.birthMonth),
    hasCompany: answers.company !== null,
    companyIncomeYen: company.income,
    companyServiceYears: company.service,
    companyReceiptAge: company.age,
    hasDc: answers.dc !== null,
    dcIncomeYen: dc.income,
    dcServiceYears: dc.service,
    dcReceiptAge: dc.age,
    hasExtra: answers.hasExtra,
    goal: answers.goal,
  };
}

export function inputFromAnswers(
  answers: HearingAnswers,
  previous: SimulationInput = defaultInput,
): SimulationInput {
  const birth = { year: answers.birthYear, month: answers.birthMonth };
  const previousBenefits = previous.benefits;
  const prevCompany = firstOfKind(previousBenefits, "company");
  const prevDc = firstOfKind(previousBenefits, "dc");
  const company = answers.company
    ? patchBenefit(
        prevCompany,
        {
          id: prevCompany?.id ?? "company",
          kind: "company",
          incomeYen: answers.company.incomeYen,
          serviceYears: Math.max(1, answers.company.serviceYears),
          receiptYear: yearOfAge(birth, answers.company.receiptAge),
        },
        keepsDetailedIntervals(prevCompany, answers.company.serviceYears),
      )
    : undefined;
  const dc = answers.dc
    ? patchBenefit(
        prevDc,
        {
          id: prevDc?.id ?? "dc",
          kind: "dc",
          incomeYen: answers.dc.incomeYen,
          serviceYears: Math.max(1, answers.dc.serviceYears),
          receiptYear: yearOfAge(birth, answers.dc.receiptAge),
          optimizeReceiptYear: answers.goal === "sequence",
        },
        keepsDetailedIntervals(prevDc, answers.dc.serviceYears),
      )
    : undefined;

  const kept: BenefitInput[] = [];
  if (company && kindHasSlot(company.kind, answers)) kept.push(company);
  if (dc && kindHasSlot(dc.kind, answers)) kept.push(dc);
  const primaryCount = kept.length;
  const previousBirthYear = hearingBirth(previous).year;
  for (const benefit of previousBenefits) {
    if (isPrimary(benefit, prevCompany, prevDc)) continue;
    if (!answers.hasExtra) continue;
    if (!kindHasSlot(benefit.kind, answers)) continue;
    if (kept.length >= MAX_BENEFITS) break;
    const receiptYear = alignedExtraReceiptYear(benefit, previousBirthYear, answers.birthYear);
    kept.push({ ...benefit, receiptYear });
  }
  const extraYear = unusedReceiptYear(kept, answers.birthYear);
  if (answers.hasExtra && kept.length === primaryCount && extraYear !== null && kept.length < MAX_BENEFITS) {
    kept.push({
      id: "extra",
      kind: "other",
      incomeYen: 0,
      serviceYears: 20,
      receiptYear: extraYear,
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
  if (birthY.ok) {
    const receiptError = birthYearReceiptError(birthY.value);
    if (receiptError) nextErrors.birthYear = receiptError;
  }
  if (!birthM.ok) nextErrors.birthMonth = birthM.error;
  const prevCompany = firstOfKind(previousBenefits, "company");
  const prevDc = firstOfKind(previousBenefits, "dc");
  const company = draft.hasCompany
    ? parseTriplet(
        {
          income: draft.companyIncomeYen,
          service: draft.companyServiceYears,
          age: draft.companyReceiptAge,
        },
        { income: "companyIncomeYen", service: "companyServiceYears", age: "companyReceiptAge" },
        birthY.ok ? birthY.value : null,
        "勤続年数",
        "company",
      )
    : null;
  if (company && !company.ok) Object.assign(nextErrors, company.errors);
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

  const shared = Boolean(company?.ok && draft.hasDc && draft.goal === "simultaneous" && dc?.ok);
  const companyAge = shared && dc?.ok ? dc.age : company?.ok ? company.age : null;
  const dcAge = dc?.ok ? dc.age : null;
  if (company?.ok && companyAge !== null && birthY.ok && !keepsDetailedIntervals(prevCompany, company.service)) {
    const conflict = tenureConflict(company.service, companyAge, birthY.value, birthM.ok ? birthM.value : null);
    if (conflict) nextErrors.companyReceiptAge = conflict;
  }
  if (dc?.ok && dcAge !== null && birthY.ok && !keepsDetailedIntervals(prevDc, dc.service)) {
    const conflict = tenureConflict(dc.service, dcAge, birthY.value, birthM.ok ? birthM.value : null);
    if (conflict) nextErrors.dcReceiptAge = conflict;
  }

  if (
    Object.keys(nextErrors).length > 0 ||
    !birthY.ok ||
    !birthM.ok ||
    (draft.hasCompany && !company?.ok) ||
    (draft.hasDc && !dc?.ok)
  ) {
    return { ok: false, errors: nextErrors };
  }
  return {
    ok: true,
    value: {
      birthYear: birthY.value,
      birthMonth: birthM.value,
      company:
        company?.ok === true
          ? {
              incomeYen: company.income,
              serviceYears: company.service,
              receiptAge: companyAge ?? company.age,
            }
          : null,
      dc:
        dc?.ok === true
          ? {
              incomeYen: dc.income,
              serviceYears: dc.service,
              receiptAge: dcAge ?? dc.age,
            }
          : null,
      hasExtra: draft.hasExtra,
      goal: draft.goal,
    },
  };
}

export function hearingStepErrorKeys(
  step: HearingStepId,
  draft: Pick<HearingDraft, "hasCompany" | "hasDc" | "goal">,
): string[] {
  switch (step) {
    case "birth":
      return ["birthYear", "birthMonth"];
    case "hasCompany":
      return [];
    case "company":
      return ["companyIncomeYen", "companyServiceYears", "companyReceiptAge"];
    case "dc":
      return ["dcIncomeYen", "dcServiceYears", "dcReceiptAge"];
    case "hasDc":
    case "hasExtra":
      return [];
    case "goal":
      if (!(draft.hasDc && draft.goal === "simultaneous")) return [];
      return draft.hasCompany ? ["companyReceiptAge", "dcReceiptAge"] : ["dcReceiptAge"];
    default: {
      const unreachable: never = step;
      return unreachable;
    }
  }
}

export function hearingStepForErrors(
  draft: Pick<HearingDraft, "hasCompany" | "hasDc" | "goal">,
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
  if (
    draft.hasCompany &&
    (errors.companyIncomeYen || errors.companyServiceYears || errors.companyReceiptAge)
  ) {
    return "company";
  }
  if (errors.dcIncomeYen || errors.dcServiceYears || errors.dcReceiptAge) return "dc";
  return "goal";
}
