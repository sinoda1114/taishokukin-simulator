import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  defaultRuleset,
  simulate,
  type SimulationInput,
  type SimulationResult,
  type TaxRuleset,
} from "@/engine";
import { getDb } from "@/db/client";
import { simulations, taxRulesets, usageEvents } from "@/db/schema";
import { parseSimulationInput } from "@/lib/parse-input";

function now() {
  return new Date();
}

function id(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export async function seedRulesetIfNeeded(): Promise<void> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(taxRulesets)
    .where(eq(taxRulesets.version, defaultRuleset.version))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(taxRulesets).values({
    version: defaultRuleset.version,
    effectiveFrom: "2026-01-01",
    payloadJson: JSON.stringify(defaultRuleset),
    note: "MVP seed",
    createdAt: now(),
  });
}

export async function loadRuleset(): Promise<TaxRuleset> {
  await seedRulesetIfNeeded();
  const db = await getDb();
  const existing = await db
    .select()
    .from(taxRulesets)
    .where(eq(taxRulesets.version, defaultRuleset.version))
    .limit(1);
  const row = existing[0];
  if (!row) return defaultRuleset;
  try {
    return JSON.parse(row.payloadJson) as TaxRuleset;
  } catch {
    return defaultRuleset;
  }
}

export async function saveSimulation(input: SimulationInput): Promise<{
  token: string;
  result: SimulationResult;
}> {
  await seedRulesetIfNeeded();
  const ruleset = await loadRuleset();
  const result = simulate(input, ruleset);
  const token = id(24);
  const db = await getDb();
  const at = now();
  await db.insert(simulations).values({
    id: id(12),
    shareToken: token,
    ownerUserId: null,
    title: null,
    inputJson: JSON.stringify(input),
    resultJson: JSON.stringify(result),
    rulesetVersion: result.rulesetVersion,
    createdAt: at,
    updatedAt: at,
  });
  return { token, result };
}

export async function loadSimulation(token: string): Promise<{
  input: SimulationInput;
  result: SimulationResult;
  rulesetVersion: string;
} | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(simulations)
    .where(eq(simulations.shareToken, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    const input = parseSimulationInput(JSON.parse(row.inputJson));
    const ruleset = await loadRuleset();
    const result = simulate(input, ruleset);
    return { input, result, rulesetVersion: row.rulesetVersion };
  } catch {
    return null;
  }
}

export async function logUsage(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(usageEvents).values({
    id: id(12),
    eventType,
    payloadJson: JSON.stringify(payload),
    createdAt: now(),
  });
}
