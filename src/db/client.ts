import "server-only";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) {
    throw new Error("本番では TURSO_DATABASE_URL が必要です");
  }
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "local.db")}`;
}

let db: ReturnType<typeof drizzle> | undefined;
let schemaReady: Promise<void> | undefined;
let sqlite: ReturnType<typeof createClient> | undefined;

async function ensureSchema(): Promise<void> {
  sqlite ??= createClient({
    url: databaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  for (const statement of schema.CREATE_TABLES_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
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
