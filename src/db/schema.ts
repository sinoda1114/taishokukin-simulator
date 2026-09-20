import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const taxRulesets = sqliteTable("tax_rulesets", {
  version: text("version").primaryKey(),
  effectiveFrom: text("effective_from").notNull(),
  payloadJson: text("payload_json").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const simulations = sqliteTable("simulations", {
  id: text("id").primaryKey(),
  shareToken: text("share_token").notNull().unique(),
  ownerUserId: text("owner_user_id"),
  title: text("title"),
  inputJson: text("input_json").notNull(),
  resultJson: text("result_json"),
  rulesetVersion: text("ruleset_version").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS tax_rulesets (
  version TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  share_token TEXT NOT NULL UNIQUE,
  owner_user_id TEXT,
  title TEXT,
  input_json TEXT NOT NULL,
  result_json TEXT,
  ruleset_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;
