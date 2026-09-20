import { applySchema, openClient } from "./connection";
import { resolveDbConnection } from "./config";

try {
  const conn = resolveDbConnection(process.env);
  const client = await openClient(conn);
  await applySchema(client);
  console.log(
    conn.kind === "remote"
      ? "Turso スキーマを適用しました"
      : "ローカル DB にスキーマを適用しました",
  );
} catch (error) {
  console.error(
    "スキーマ適用に失敗しました:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
