import { describe, expect, it } from "vitest";
import { defaultInput } from "./default-input";
import {
  answersFromInput,
  inputFromAnswers,
  nextHearingStep,
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
    expect(answers.hasDc).toBe(true);
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
      companyReceiptYear: 2030,
      hasDc: false,
      dcIncomeYen: 10_000_000,
      dcServiceYears: 20,
      dcReceiptYear: 2031,
      hasExtra: false,
      goal: "simultaneous",
    });
    expect(input.benefits).toHaveLength(1);
    expect(input.benefits[0]?.kind).toBe("company");
  });

  it("sets DC receipt to the company year for simultaneous", () => {
    const input = inputFromAnswers({
      birthYear: 1965,
      birthMonth: 4,
      companyIncomeYen: 20_000_000,
      companyServiceYears: 30,
      companyReceiptYear: 2030,
      hasDc: true,
      dcIncomeYen: 10_000_000,
      dcServiceYears: 20,
      dcReceiptYear: 2034,
      hasExtra: false,
      goal: "simultaneous",
    });
    const dc = input.benefits.find((b) => b.kind === "dc");
    expect(dc?.receiptYear).toBe(2030);
    expect(dc?.optimizeReceiptYear).toBe(false);
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
