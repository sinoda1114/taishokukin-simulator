import type { SimulationInput } from "@/engine";

export const defaultInput: SimulationInput = {
  schemaVersion: 1,
  birthYearMonth: { year: 1965, month: 4 },
  ruleMode: "auto",
  benefits: [
    {
      id: "company",
      kind: "company",
      incomeYen: 20_000_000,
      serviceYears: 30,
      receiptYear: 2030,
    },
    {
      id: "dc",
      kind: "dc",
      incomeYen: 10_000_000,
      serviceYears: 20,
      receiptYear: 2030,
      optimizeReceiptYear: true,
    },
  ],
};
