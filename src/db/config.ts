export type DbEnv = {
  [key: string]: string | undefined;
};

export type DbConnection =
  | { kind: "file"; url: string }
  | { kind: "remote"; url: string; authToken: string };

const LOCAL_FILE_URL = "file:./data/local.db";

const REMOTE_URL = /^(libsql|https|http|wss|ws):\/\//i;

export function resolveDbConnection(env: DbEnv): DbConnection {
  const url = cleanEnv(env.TURSO_DATABASE_URL);
  const authToken = cleanEnv(env.TURSO_AUTH_TOKEN);
  const onVercel = Boolean(env.VERCEL);

  if (!url) {
    if (onVercel) {
      throw new Error("Vercel では TURSO_DATABASE_URL が必要です");
    }
    return { kind: "file", url: LOCAL_FILE_URL };
  }

  if (isFileUrl(url)) {
    if (onVercel) {
      throw new Error("Vercel では file: の TURSO_DATABASE_URL は使えません");
    }
    return { kind: "file", url };
  }

  if (!REMOTE_URL.test(url)) {
    throw new Error("TURSO_DATABASE_URL の形式が不正です");
  }

  if (!authToken) {
    throw new Error("リモート Turso には TURSO_AUTH_TOKEN が必要です");
  }

  return { kind: "remote", url, authToken };
}

function cleanEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

function isFileUrl(url: string): boolean {
  return url === ":memory:" || url.startsWith("file:");
}
