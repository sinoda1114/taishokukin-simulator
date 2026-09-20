import type { TaxRuleset } from "./types";

export const DEFAULT_RULESET_VERSION = "2026.1";

export const defaultRuleset: TaxRuleset = {
  schemaVersion: 1,
  version: DEFAULT_RULESET_VERSION,
  amendmentEffectiveYear: 2026,
  reconstructionSurtaxUntilYear: 2037,
  reconstructionSurtaxRateBp: 21,
  incomeTaxBrackets: [
    { upToInclusive: 1_949_000, rateBp: 50, deductionYen: 0 },
    { upToInclusive: 3_299_000, rateBp: 100, deductionYen: 97_500 },
    { upToInclusive: 6_949_000, rateBp: 200, deductionYen: 427_500 },
    { upToInclusive: 8_999_000, rateBp: 230, deductionYen: 636_000 },
    { upToInclusive: 17_999_000, rateBp: 330, deductionYen: 1_536_000 },
    { upToInclusive: 39_999_000, rateBp: 400, deductionYen: 2_796_000 },
    { upToInclusive: null, rateBp: 450, deductionYen: 4_796_000 },
  ],
  municipalRateBp: 60,
  prefecturalRateBp: 40,
  basicDeductionPerYearYen: 400_000,
  longServiceThresholdYears: 20,
  longServiceBaseYen: 8_000_000,
  longServicePerYearYen: 700_000,
  minimumDeductionYen: 800_000,
  disabilityAdditionYen: 1_000_000,
  windows: {
    generalToGeneral: 4,
    generalToDcPreAmendment: 4,
    generalToDcPostAmendment: 9,
    dcToAny: 19,
  },
  dcReceiptAgeMin: 60,
  dcReceiptAgeMax: 75,
};
