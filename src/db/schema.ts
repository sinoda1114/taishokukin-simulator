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
