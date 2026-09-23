export function digitsFromPickerSearch(query: string, selectedLabel: string | null): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  const rest =
    selectedLabel && (trimmed === selectedLabel || trimmed.startsWith(selectedLabel))
      ? trimmed.slice(selectedLabel.length)
      : trimmed;
  const match = rest.match(/\d+/);
  return match ? match[0] : "";
}

export function prefixCenter(digits: string, min: number, max: number, fallback: number): number {
  if (!/^\d+$/.test(digits)) return fallback;
  const typed = Number(digits);
  if (typed >= min && typed <= max) return typed;
  for (let n = min; n <= max; n += 1) {
    if (String(n).startsWith(digits)) return n;
  }
  return fallback;
}
