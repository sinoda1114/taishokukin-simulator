import type { Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DbConnection } from "./config";
import { CREATE_TABLES_SQL } from "./schema";

export async function openClient(conn: DbConnection): Promise<Client> {
  if (conn.kind === "remote") {
    const { createClient } = await import("@libsql/client/web");
    return createClient({ url: conn.url, authToken: conn.authToken });
  }
  ensureLocalFileDir(conn.url);
  const { createClient } = await import("@libsql/client");
  return createClient({ url: conn.url });
}

export async function applySchema(client: Client): Promise<void> {
  for (const statement of CREATE_TABLES_SQL.split(";")
    .map((sql) => sql.trim())
    .filter(Boolean)) {
    await client.execute(statement);
  }
}

function ensureLocalFileDir(url: string): void {
  if (url === ":memory:") return;
  const filePath = url.replace(/^file:(?:\/\/)?/, "");
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
}
