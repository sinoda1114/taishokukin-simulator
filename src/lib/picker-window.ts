export const MAX_PICKER_OPTIONS = 80;

export function pickerWindow(
  min: number,
  max: number,
  center: number,
  align: "center" | "start" = "center",
): { min: number; max: number } {
  if (max < min) return { min, max };
  if (max - min + 1 <= MAX_PICKER_OPTIONS) return { min, max };
  const clamped = Math.min(max, Math.max(min, center));
  if (align === "start") {
    let lo = clamped;
    let hi = lo + MAX_PICKER_OPTIONS - 1;
    if (hi > max) {
      hi = max;
      lo = Math.max(min, max - MAX_PICKER_OPTIONS + 1);
    }
    return { min: lo, max: hi };
  }
  const half = Math.floor(MAX_PICKER_OPTIONS / 2);
  let lo = clamped - half;
  let hi = lo + MAX_PICKER_OPTIONS - 1;
  if (lo < min) {
    lo = min;
    hi = min + MAX_PICKER_OPTIONS - 1;
  }
  if (hi > max) {
    hi = max;
    lo = Math.max(min, max - MAX_PICKER_OPTIONS + 1);
  }
  return { min: lo, max: hi };
}
