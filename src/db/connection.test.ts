import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applySchema, openClient } from "./connection";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("openClient + applySchema", () => {
  it("creates tables on a local libSQL file", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "taishoku-db-"));
    dirs.push(dir);
    const url = `file:${path.join(dir, "test.db")}`;
    const client = await openClient({ kind: "file", url });
    await applySchema(client);
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.rows.map((row) => String(row.name));
    expect(names).toEqual(["simulations", "tax_rulesets", "usage_events"]);
    await client.close();
  });
});
