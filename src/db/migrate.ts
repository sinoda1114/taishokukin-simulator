import { openMigratedClient } from "./connection";
import { resolveDbConnection } from "./config";

const conn = resolveDbConnection(process.env);
await openMigratedClient();
console.log(
  conn.kind === "remote"
    ? "Turso スキーマを適用しました"
    : "ローカル DB にスキーマを適用しました",
);
