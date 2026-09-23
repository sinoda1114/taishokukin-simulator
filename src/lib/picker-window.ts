export const MAX_PICKER_OPTIONS = 80;

export function pickerWindow(
  min: number,
  max: number,
  selected: number | null,
  nowYear = new Date().getFullYear(),
): { min: number; max: number } {
  if (max < min) return { min, max };
  if (max - min + 1 <= MAX_PICKER_OPTIONS) return { min, max };
  const center = selected ?? defaultCenter(min, max, nowYear);
  const half = Math.floor(MAX_PICKER_OPTIONS / 2);
  let lo = center - half;
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

function defaultCenter(min: number, max: number, nowYear: number): number {
  if (min >= 1800) return Math.min(max, Math.max(min, nowYear));
  if (min <= 20 && max >= 80) return Math.min(max, Math.max(min, 65));
  return Math.round((min + max) / 2);
}
