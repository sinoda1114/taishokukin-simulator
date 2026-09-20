import { describe, expect, it } from "vitest";
import { CREATE_TABLES_SQL, ddlStatements } from "./schema";

describe("ddlStatements", () => {
  it("splits CREATE TABLE statements without dropping any", () => {
    const statements = ddlStatements();
    expect(statements).toHaveLength(3);
    expect(statements.every((s) => s.startsWith("CREATE TABLE IF NOT EXISTS"))).toBe(
      true,
    );
    expect(CREATE_TABLES_SQL).toContain("tax_rulesets");
    expect(CREATE_TABLES_SQL).toContain("simulations");
    expect(CREATE_TABLES_SQL).toContain("usage_events");
  });
});
