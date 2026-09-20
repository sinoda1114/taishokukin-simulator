import { defaultRuleset } from "./ruleset";
import { freezeServiceIntervals, simulate, yearOfAge } from "./simulate";
import type {
  BenefitInput,
  PatternComparison,
  PatternKind,
  SimulationInput,
  TaxRuleset,
} from "./types";

function withReceiptYear(benefit: BenefitInput, year: number): BenefitInput {
  return { ...benefit, receiptYear: year, optimizeReceiptYear: false };
}

function replaceBenefits(
  input: SimulationInput,
  next: BenefitInput[],
): SimulationInput {
  return { ...input, benefits: next };
}

export function isCompanyPlusDcPair(benefits: BenefitInput[]): boolean {
  if (benefits.length !== 2) return false;
  const kinds = benefits.map((b) => b.kind).sort();
  return kinds[0] === "company" && kinds[1] === "dc";
}

export function buildThreePatterns(
  input: SimulationInput,
  ruleset: TaxRuleset = defaultRuleset,
): PatternComparison[] | null {
  if (!isCompanyPlusDcPair(input.benefits)) return null;
  const frozen = freezeServiceIntervals(input);
  const company = frozen.benefits.find((b) => b.kind === "company");
  const dc = frozen.benefits.find((b) => b.kind === "dc");
  if (!company || !dc) return null;

  const age60 = input.birthYearMonth
    ? yearOfAge(input.birthYearMonth, ruleset.dcReceiptAgeMin)
    : company.receiptYear - 5;
  const age75 = input.birthYearMonth
    ? yearOfAge(input.birthYearMonth, ruleset.dcReceiptAgeMax)
    : age60 + (ruleset.dcReceiptAgeMax - ruleset.dcReceiptAgeMin);

  const canDc = (year: number) => year >= age60 && year <= age75;

  const rows: Array<{ kind: PatternKind; label: string; companyYear: number; dcYear: number }> =
    [
      {
        kind: "simultaneous",
        label: "同時受取",
        companyYear: company.receiptYear,
        dcYear: company.receiptYear,
      },
      {
        kind: "company_first",
        label: "退職金先",
        companyYear: company.receiptYear,
        dcYear: Math.min(age75, Math.max(company.receiptYear + 1, age60)),
      },
      {
        kind: "dc_first",
        label: "iDeCo先",
        companyYear: company.receiptYear,
        dcYear: age60,
      },
    ];

  return rows.map((row) => {
    let omitted: string | undefined;
    if (!canDc(row.dcYear)) {
      omitted = "iDeCoの受取可能年（60〜75歳の暦年）に入りません";
    } else if (row.kind === "company_first" && row.dcYear <= row.companyYear) {
      omitted = "退職金より後のiDeCo受取年を取れません";
    } else if (row.kind === "dc_first" && row.dcYear >= row.companyYear) {
      omitted = "会社の受取年がiDeCo開始可能年以前のため、この順は作れません";
    }
    const nextInput = replaceBenefits(frozen, [
      withReceiptYear(company, row.companyYear),
      withReceiptYear(dc, row.dcYear),
    ]);
    if (omitted) {
      return {
        kind: row.kind,
        label: row.label,
        input: nextInput,
        omittedReason: omitted,
      };
    }
    return {
      kind: row.kind,
      label: row.label,
      input: nextInput,
      result: simulate(nextInput, ruleset),
    };
  });
}
