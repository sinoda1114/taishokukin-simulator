import { dcMinimumReceiptAgeFromMonths } from "./dc-age";
import { dcReceiptYears } from "./explain";
import { defaultRuleset } from "./ruleset";
import {
  benefitAtReceiptYear,
  dcReceiptAgeAllowed,
  membershipMonthsAtReceipt,
  simulate,
  yearOfAge,
} from "./simulate";
import type {
  BenefitInput,
  PatternComparison,
  PatternKind,
  SimulationInput,
  TaxRuleset,
} from "./types";

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
  const company = input.benefits.find((b) => b.kind === "company");
  const dc = input.benefits.find((b) => b.kind === "dc");
  if (!company || !dc) return null;

  const birth = input.birthYearMonth;
  const earliest = birth
    ? (dcReceiptYears(birth.year, ruleset).find((year) =>
        dcReceiptAgeAllowed(dc, year, birth, ruleset),
      ) ?? null)
    : company.receiptYear - 5;
  const age75 = birth
    ? yearOfAge(birth, ruleset.dcReceiptAgeMax)
    : (earliest ?? company.receiptYear) + (ruleset.dcReceiptAgeMax - ruleset.dcReceiptAgeMin);

  const canDc = (year: number) =>
    birth ? dcReceiptAgeAllowed(dc, year, birth, ruleset) : year >= (earliest ?? year) && year <= age75;

  const dcFirstYear = earliest ?? age75;
  const companyFirstYear = Math.min(age75, Math.max(company.receiptYear + 1, dcFirstYear));

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
        dcYear: companyFirstYear,
      },
      {
        kind: "dc_first",
        label: "iDeCo先",
        companyYear: company.receiptYear,
        dcYear: dcFirstYear,
      },
    ];

  return rows.map((row) => {
    let omitted: string | undefined;
    const minAge = birth
      ? dcMinimumReceiptAgeFromMonths(membershipMonthsAtReceipt(dc, birth, row.dcYear), ruleset)
      : ruleset.dcReceiptAgeMin;
    if (!canDc(row.dcYear)) {
      omitted = `iDeCoの受取可能年（${minAge}〜${ruleset.dcReceiptAgeMax}歳の暦年）に入りません`;
    } else if (row.kind === "company_first" && row.dcYear <= row.companyYear) {
      omitted = "退職金より後のiDeCo受取年を取れません";
    } else if (row.kind === "dc_first" && row.dcYear >= row.companyYear) {
      omitted = "会社の受取年がiDeCo開始可能年以前のため、この順は作れません";
    }
    const nextInput = replaceBenefits(input, [
      benefitAtReceiptYear(company, row.companyYear, birth),
      benefitAtReceiptYear(dc, row.dcYear, birth),
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
