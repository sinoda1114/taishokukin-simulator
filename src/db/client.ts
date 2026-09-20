import "server-only";

import { drizzle } from "drizzle-orm/libsql";
import { openMigratedClient } from "./connection";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle> | undefined;
let schemaReady: Promise<void> | undefined;
let sqlite: Awaited<ReturnType<typeof openMigratedClient>> | undefined;

async function ensureSchema(): Promise<void> {
  sqlite ??= await openMigratedClient();
}

export async function getDb() {
  schemaReady ??= ensureSchema();
  await schemaReady;
  if (!sqlite) {
    throw new Error("データベースクライアントの初期化に失敗しました");
  }
  db ??= drizzle(sqlite, { schema });
  return db;
}
