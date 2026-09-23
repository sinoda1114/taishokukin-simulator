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
});
