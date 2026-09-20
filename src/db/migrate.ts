import { applySchema, openClient } from "./connection";
import { resolveDbConnection } from "./config";

const conn = resolveDbConnection(process.env);
const client = await openClient(conn);
await applySchema(client);
console.log(
  conn.kind === "remote"
    ? "Turso スキーマを適用しました"
    : "ローカル DB にスキーマを適用しました",
);
