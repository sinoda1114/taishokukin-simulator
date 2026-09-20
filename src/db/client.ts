import "server-only";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const dir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "local.db")}`;
}

let db: ReturnType<typeof drizzle> | undefined;
let schemaReady: Promise<void> | undefined;
let sqlite: ReturnType<typeof createClient> | undefined;

const DDL = `
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

async function ensureSchema(): Promise<void> {
  sqlite ??= createClient({
    url: databaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  for (const statement of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sqlite.execute(statement);
  }
}

export async function getDb() {
  schemaReady ??= ensureSchema();
  await schemaReady;
  sqlite ??= createClient({
    url: databaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  db ??= drizzle(sqlite, { schema });
  return db;
}
