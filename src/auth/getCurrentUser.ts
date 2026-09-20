import "server-only";

export type CurrentUser = {
  id: string;
  provider: "clerk";
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const provider = process.env.AUTH_PROVIDER ?? "none";
  if (provider === "none") return null;
  return null;
}
