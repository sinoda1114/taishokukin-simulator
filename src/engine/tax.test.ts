import { describe, expect, it } from "vitest";
import { nationalTaxYen, residentTaxYen, retirementTaxableYen } from "./tax";

describe("tax rounding", () => {
  it("halves then floors to 1000 yen, including a 50-sen remainder", () => {
    expect(retirementTaxableYen(15_313_633, 11_500_000)).toBe(1_906_000);
    expect(retirementTaxableYen(20_000_000, 15_000_000)).toBe(2_500_000);
    expect(retirementTaxableYen(8_000_000, 18_500_000)).toBe(0);
  });

  it("applies reconstruction surtax on the combined amount and floors 1 yen", () => {
    const tax = nationalTaxYen(4_000_000, 2030);
    expect(tax.incomeTaxYen).toBe(372_500);
    expect(tax.nationalTaxYen).toBe(380_322);
    expect(tax.reconstructionTaxYen).toBe(7_822);
  });

  it("splits resident tax 6% / 4% and floors each to 100 yen", () => {
    const tax = residentTaxYen(1_906_000);
    expect(tax.municipalTaxYen).toBe(114_300);
    expect(tax.prefecturalTaxYen).toBe(76_200);
    expect(tax.residentTaxYen).toBe(190_500);
  });

  it("drops reconstruction surtax after 2037", () => {
    const tax = nationalTaxYen(2_500_000, 2038);
    expect(tax.incomeTaxYen).toBe(152_500);
    expect(tax.reconstructionTaxYen).toBe(0);
    expect(tax.nationalTaxYen).toBe(152_500);
  });
});
