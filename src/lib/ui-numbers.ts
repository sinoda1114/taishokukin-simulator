export function toInt(value: string | number, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}
