import type { Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { resolveDbConnection, type DbConnection, type DbEnv } from "./config";
import { ddlStatements } from "./schema";

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
  for (const statement of ddlStatements()) {
    await client.execute(statement);
  }
}

export async function openMigratedClient(env: DbEnv = process.env): Promise<Client> {
  const client = await openClient(resolveDbConnection(env));
  await applySchema(client);
  return client;
}

function ensureLocalFileDir(url: string): void {
  if (url === ":memory:") return;
  const filePath = url.replace(/^file:(?:\/\/)?/, "");
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
}
