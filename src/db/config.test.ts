import { describe, expect, it } from "vitest";
import { resolveDbConnection } from "./config";

describe("resolveDbConnection", () => {
  it("defaults to a local file database off Vercel", () => {
    expect(resolveDbConnection({})).toEqual({
      kind: "file",
      url: "file:./data/local.db",
    });
  });

  it("keeps an explicit file URL locally", () => {
    expect(
      resolveDbConnection({ TURSO_DATABASE_URL: "file:./tmp/app.db" }),
    ).toEqual({ kind: "file", url: "file:./tmp/app.db" });
  });

  it("requires a remote Turso URL on Vercel", () => {
    expect(() => resolveDbConnection({ VERCEL: "1" })).toThrow(
      /TURSO_DATABASE_URL/,
    );
  });

  it("rejects file URLs on Vercel even when the env is set", () => {
    expect(() =>
      resolveDbConnection({
        VERCEL: "1",
        TURSO_DATABASE_URL: "file:./data/local.db",
      }),
    ).toThrow(/file:/);
  });

  it("requires a token for remote URLs", () => {
    expect(() =>
      resolveDbConnection({
        TURSO_DATABASE_URL: "libsql://example.turso.io",
      }),
    ).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("accepts a Turso URL and token", () => {
    expect(
      resolveDbConnection({
        VERCEL: "1",
        TURSO_DATABASE_URL: ' libsql://example.turso.io ',
        TURSO_AUTH_TOKEN: '"tok_test"',
      }),
    ).toEqual({
      kind: "remote",
      url: "libsql://example.turso.io",
      authToken: "tok_test",
    });
  });

  it("rejects unknown URL schemes", () => {
    expect(() =>
      resolveDbConnection({ TURSO_DATABASE_URL: "postgres://localhost/db" }),
    ).toThrow(/形式/);
  });
});
