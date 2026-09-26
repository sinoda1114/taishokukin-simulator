import { describe, expect, it } from "vitest";
import { defaultInput } from "./default-input";
import {
  answersFromInput,
  hearingStepForErrors,
  inputFromAnswers,
  nextHearingStep,
  parseDraft,
  prevHearingStep,
  visibleHearingSteps,
} from "./hearing";
import { parseSimulationInput } from "./parse-input";
import { simulate } from "@/engine";

describe("hearing steps", () => {
  it("skips DC details when there is no DC", () => {
    expect(visibleHearingSteps(false)).toEqual(["birth", "company", "hasDc", "hasExtra", "goal"]);
    expect(nextHearingStep("hasDc", false)).toBe("hasExtra");
    expect(prevHearingStep("hasExtra", false)).toBe("hasDc");
  });

  it("asks DC details when there is a DC", () => {
    expect(nextHearingStep("hasDc", true)).toBe("dc");
    expect(nextHearingStep("goal", true)).toBe("done");
    expect(prevHearingStep("birth", true)).toBeNull();
  });
});

describe("hearing mapping", () => {
  it("round-trips the sample input used for skip", () => {
    const answers = answersFromInput(defaultInput);
    expect(answers.companyReceiptAge).toBe(60);
    expect(answers.dcReceiptAge).toBe(60);
    expect(answers.hasExtra).toBe(false);
    expect(answers.goal).toBe("sequence");
    const next = inputFromAnswers(answers);
    expect(next).toEqual(defaultInput);
    expect(simulate(parseSimulationInput(next)).totalTaxYen).toBe(1_861_869);
  });

  it("drops DC and aligns years for simultaneous company-only", () => {
    const input = inputFromAnswers({
      birthYear: 1965,
      birthMonth: 4,
      companyIncomeYen: 20_000_000,
      companyServiceYears: 30,
      companyReceiptAge: 65,
      hasDc: false,
      dcIncomeYen: 10_000_000,
      dcServiceYears: 20,
      dcReceiptAge: 66,
      hasExtra: false,
      goal: "simultaneous",
    });
    expect(input.benefits).toHaveLength(1);
    expect(input.benefits[0]?.kind).toBe("company");
  });

  it("does not overwrite either age unless the draft says they are the same", () => {
    const input = inputFromAnswers({
      birthYear: 1965,
      birthMonth: 4,
      companyIncomeYen: 20_000_000,
      companyServiceYears: 30,
      companyReceiptAge: 55,
      hasDc: true,
      dcIncomeYen: 10_000_000,
      dcServiceYears: 20,
      dcReceiptAge: 62,
      hasExtra: false,
      goal: "simultaneous",
    });
    expect(input.benefits.find((b) => b.kind === "company")?.receiptYear).toBe(2020);
    expect(input.benefits.find((b) => b.kind === "dc")?.receiptYear).toBe(2027);
  });

  it("uses the one age written onto both benefits", () => {
    const input = inputFromAnswers({
      birthYear: 1965,
      birthMonth: 4,
      companyIncomeYen: 20_000_000,
      companyServiceYears: 30,
      companyReceiptAge: 62,
      hasDc: true,
      dcIncomeYen: 10_000_000,
      dcServiceYears: 20,
      dcReceiptAge: 62,
      hasExtra: false,
      goal: "simultaneous",
    });
    expect(input.benefits.find((b) => b.kind === "company")?.receiptYear).toBe(2027);
    expect(input.benefits.find((b) => b.kind === "dc")?.receiptYear).toBe(2027);
    expect(input.benefits.find((b) => b.kind === "dc")?.optimizeReceiptYear).toBe(false);
  });

  it("keeps year-month intervals when the hearing years are unchanged", () => {
    const intervals = [
      { start: { year: 2006, month: 1 }, end: { year: 2015, month: 12 } },
      { start: { year: 2018, month: 1 }, end: { year: 2022, month: 12 } },
    ];
    const previous = {
      ...defaultInput,
      benefits: defaultInput.benefits.map((benefit) =>
        benefit.kind === "dc" ? { ...benefit, intervals } : benefit,
      ),
    };
    const answers = answersFromInput(previous);
    expect(answers.dcServiceYears).toBe(15);
    const next = inputFromAnswers(answers, previous);
    expect(next.benefits.find((benefit) => benefit.kind === "dc")?.intervals).toEqual(intervals);
  });

  it("drops intervals only when the hearing year count changes", () => {
    const intervals = [
      { start: { year: 2006, month: 1 }, end: { year: 2015, month: 12 } },
      { start: { year: 2018, month: 1 }, end: { year: 2022, month: 12 } },
    ];
    const previous = {
      ...defaultInput,
      benefits: defaultInput.benefits.map((benefit) =>
        benefit.kind === "dc" ? { ...benefit, intervals } : benefit,
      ),
    };
    const answers = { ...answersFromInput(previous), dcServiceYears: 16 };
    const next = inputFromAnswers(answers, previous);
    expect(next.benefits.find((benefit) => benefit.kind === "dc")?.intervals).toBeUndefined();
    expect(next.benefits.find((benefit) => benefit.kind === "dc")?.serviceYears).toBe(16);
  });

  it("appends an extra allowance the user can edit later", () => {
    const input = inputFromAnswers({
      ...answersFromInput(defaultInput),
      hasExtra: true,
    });
    expect(input.benefits.map((b) => b.kind)).toEqual(["company", "dc", "other"]);
  });

  it("keeps edited extra benefits when returning from the form", () => {
    const extra = {
      id: "kept",
      kind: "other" as const,
      incomeYen: 3_000_000,
      serviceYears: 10,
      receiptYear: 2031,
    };
    const input = inputFromAnswers(
      { ...answersFromInput(defaultInput), hasExtra: true },
      { ...defaultInput, benefits: [...defaultInput.benefits, extra] },
    );
    expect(input.benefits.map((b) => b.kind)).toEqual(["company", "dc", "other"]);
    expect(input.benefits[2]).toMatchObject({ id: "kept", incomeYen: 3_000_000 });
  });

  it("keeps a different DC year when the user did not ask for simultaneous", () => {
    const previous = {
      ...defaultInput,
      benefits: defaultInput.benefits.map((benefit) =>
        benefit.kind === "dc"
          ? { ...benefit, receiptYear: 2035, optimizeReceiptYear: false }
          : benefit,
      ),
    };
    const answers = answersFromInput(previous);
    expect(answers.goal).toBe("sequence");
    const next = inputFromAnswers(answers, previous);
    expect(next.benefits.find((benefit) => benefit.kind === "dc")?.receiptYear).toBe(2035);
    expect(simulate(parseSimulationInput(next)).totalTaxYen).toBe(
      simulate(parseSimulationInput(previous)).totalTaxYen,
    );
  });

  it("adds an extra stub that does not change tax", () => {
    const previous = inputFromAnswers({
      ...answersFromInput(defaultInput),
      hasDc: false,
      hasExtra: false,
    });
    const next = inputFromAnswers({ ...answersFromInput(previous), hasExtra: true }, previous);
    expect(next.benefits.map((b) => b.kind)).toEqual(["company", "other"]);
    expect(next.benefits[1]?.incomeYen).toBe(0);
    expect(simulate(parseSimulationInput(next)).totalTaxYen).toBe(
      simulate(parseSimulationInput(previous)).totalTaxYen,
    );
  });

  it("keeps rule mode and disability flags from the previous input", () => {
    const previous = {
      ...defaultInput,
      ruleMode: "pre_2026" as const,
      benefits: defaultInput.benefits.map((benefit) =>
        benefit.kind === "company" ? { ...benefit, disability: true } : benefit,
      ),
    };
    const next = inputFromAnswers(answersFromInput(previous), previous);
    expect(next.ruleMode).toBe("pre_2026");
    expect(next.benefits.find((benefit) => benefit.kind === "company")?.disability).toBe(true);
    expect(simulate(parseSimulationInput(previous)).totalTaxYen).toBe(
      simulate(parseSimulationInput(next)).totalTaxYen,
    );
  });
});

describe("parseDraft", () => {
  const base = {
    birthYear: "1965",
    birthMonth: "4",
    companyIncomeYen: "20000000",
    companyServiceYears: "30",
    companyReceiptAge: "60",
    hasDc: true,
    dcIncomeYen: "10000000",
    dcServiceYears: "20",
    dcReceiptAge: "62",
    hasExtra: false,
    goal: "simultaneous" as const,
  };

  it("applies the one simultaneous age to both benefits", () => {
    const parsed = parseDraft({ ...base, companyReceiptAge: "55" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.companyReceiptAge).toBe(62);
    expect(parsed.value.dcReceiptAge).toBe(62);
    const next = inputFromAnswers(parsed.value);
    expect(next.benefits.find((benefit) => benefit.kind === "company")?.receiptYear).toBe(2027);
    expect(next.benefits.find((benefit) => benefit.kind === "dc")?.receiptYear).toBe(2027);
  });

  it("keeps a tenure failure on the simultaneous step", () => {
    const parsed = parseDraft({
      ...base,
      companyServiceYears: "61",
      companyReceiptAge: "75",
      dcReceiptAge: "60",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.companyReceiptAge).toContain("生年月より前");
    expect(hearingStepForErrors({ hasDc: true, goal: "simultaneous" }, parsed.errors)).toBe("goal");
  });
});
