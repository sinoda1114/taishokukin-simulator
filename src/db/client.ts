import "server-only";

import type { LibSQLDatabase } from "drizzle-orm/libsql/driver-core";
import { applySchema, openClient } from "./connection";
import { resolveDbConnection } from "./config";
import * as schema from "./schema";

type AppDb = LibSQLDatabase<typeof schema>;

let ready: Promise<AppDb> | undefined;

async function connect(): Promise<AppDb> {
  const conn = resolveDbConnection(process.env);
  const client = await openClient(conn);
  await applySchema(client);
  if (conn.kind === "remote") {
    const { drizzle } = await import("drizzle-orm/libsql/web");
    return drizzle(client, { schema });
  }
  const { drizzle } = await import("drizzle-orm/libsql");
  return drizzle(client, { schema });
}

export async function getDb(): Promise<AppDb> {
  ready ??= connect();
  try {
    return await ready;
  } catch (error) {
    ready = undefined;
    throw error;
  }
}
