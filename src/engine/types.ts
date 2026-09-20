export type YearMonth = {
  year: number;
  month: number;
};

export type MonthInterval = {
  start: YearMonth;
  end: YearMonth;
};

export type BenefitKind = "company" | "dc" | "mutual_aid" | "other";

export type AdjustmentCategory = "dc" | "general";

export type RuleMode = "auto" | "pre_2026" | "post_2026";

export type TaxBracket = {
  upToInclusive: number | null;
  rateBp: number;
  deductionYen: number;
};

export type TaxRuleset = {
  schemaVersion: 1;
  version: string;
  amendmentEffectiveYear: number;
  reconstructionSurtaxUntilYear: number;
  reconstructionSurtaxRateBp: number;
  incomeTaxBrackets: TaxBracket[];
  municipalRateBp: number;
  prefecturalRateBp: number;
  basicDeductionPerYearYen: number;
  longServiceThresholdYears: number;
  longServiceBaseYen: number;
  longServicePerYearYen: number;
  minimumDeductionYen: number;
  disabilityAdditionYen: number;
  windows: {
    generalToGeneral: number;
    generalToDcPreAmendment: number;
    generalToDcPostAmendment: number;
    dcToAny: number;
  };
  dcReceiptAgeMin: number;
  dcReceiptAgeMax: number;
};

export type BenefitInput = {
  id: string;
  kind: BenefitKind;
  label?: string;
  incomeYen: number;
  intervals?: MonthInterval[];
  serviceYears?: number;
  receiptYear: number;
  optimizeReceiptYear?: boolean;
  contributionEndAge?: number;
  disability?: boolean;
};

export type SimulationInput = {
  schemaVersion: 1;
  birthYearMonth?: YearMonth;
  ruleMode: RuleMode;
  benefits: BenefitInput[];
};

export type CalculationStep = {
  code: string;
  label: string;
  formula: string;
  substituted: string;
  resultYen?: number;
  resultYears?: number;
  resultMonths?: number;
};

export type YearTaxStatus = "ok" | "tenure_out_of_scope";

export type YearTaxResult = {
  year: number;
  benefitIds: string[];
  kinds: BenefitKind[];
  status: YearTaxStatus;
  incomeYen: number;
  serviceMonths: number;
  serviceYears: number;
  statutoryDeductionYen: number;
  overlapYears: number;
  overlapDeductionYen: number;
  deductionAfterAdjustmentYen: number;
  taxableYen: number | null;
  incomeTaxYen: number | null;
  reconstructionTaxYen: number | null;
  municipalTaxYen: number | null;
  prefecturalTaxYen: number | null;
  residentTaxYen: number | null;
  nationalTaxYen: number | null;
  totalTaxYen: number | null;
  netYen: number | null;
  steps: CalculationStep[];
  notes: string[];
};

export type SimulationWarning = {
  code: string;
  message: string;
};

export type SimulationResult = {
  schemaVersion: 1;
  rulesetVersion: string;
  years: YearTaxResult[];
  totalTaxYen: number | null;
  totalNetYen: number | null;
  warnings: SimulationWarning[];
};

export type PatternKind = "simultaneous" | "company_first" | "dc_first";

export type PatternComparison = {
  kind: PatternKind;
  label: string;
  input: SimulationInput;
  result?: SimulationResult;
  omittedReason?: string;
};

export type SearchHit = {
  receiptYears: Record<string, number>;
  result: SimulationResult;
};

export type SearchResult = {
  hits: SearchHit[];
  best: SearchHit | null;
  truncated: boolean;
  combinationCount: number;
  variedBenefitIds: string[];
};
