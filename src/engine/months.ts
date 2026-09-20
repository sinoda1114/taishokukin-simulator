import type { MonthInterval, YearMonth } from "./types";

export function toMonthIndex(ym: YearMonth): number {
  return ym.year * 12 + (ym.month - 1);
}

export function fromMonthIndex(index: number): YearMonth {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return toMonthIndex(a) - toMonthIndex(b);
}

export function intervalMonthCount(interval: MonthInterval): number {
  return toMonthIndex(interval.end) - toMonthIndex(interval.start) + 1;
}

export function assertValidInterval(interval: MonthInterval): void {
  if (interval.start.month < 1 || interval.start.month > 12) {
    throw new Error("開始月が不正です");
  }
  if (interval.end.month < 1 || interval.end.month > 12) {
    throw new Error("終了月が不正です");
  }
  if (intervalMonthCount(interval) <= 0) {
    throw new Error("勤続期間の終了が開始より前です");
  }
}

export function mergeIntervals(intervals: MonthInterval[]): MonthInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => toMonthIndex(a.start) - toMonthIndex(b.start),
  );
  const merged: MonthInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (toMonthIndex(current.start) <= toMonthIndex(last.end) + 1) {
      if (toMonthIndex(current.end) > toMonthIndex(last.end)) {
        last.end = current.end;
      }
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

export function totalMonths(intervals: MonthInterval[]): number {
  return mergeIntervals(intervals).reduce(
    (sum, interval) => sum + intervalMonthCount(interval),
    0,
  );
}

export function intersectTwo(
  a: MonthInterval,
  b: MonthInterval,
): MonthInterval | null {
  const start = Math.max(toMonthIndex(a.start), toMonthIndex(b.start));
  const end = Math.min(toMonthIndex(a.end), toMonthIndex(b.end));
  if (start > end) return null;
  return { start: fromMonthIndex(start), end: fromMonthIndex(end) };
}

export function intersectIntervals(
  left: MonthInterval[],
  right: MonthInterval[],
): MonthInterval[] {
  const a = mergeIntervals(left);
  const b = mergeIntervals(right);
  const out: MonthInterval[] = [];
  for (const x of a) {
    for (const y of b) {
      const hit = intersectTwo(x, y);
      if (hit) out.push(hit);
    }
  }
  return mergeIntervals(out);
}

export function earliestStart(intervals: MonthInterval[]): YearMonth | null {
  const merged = mergeIntervals(intervals);
  if (merged.length === 0) return null;
  return merged[0].start;
}

export function latestEnd(intervals: MonthInterval[]): YearMonth | null {
  const merged = mergeIntervals(intervals);
  if (merged.length === 0) return null;
  return merged[merged.length - 1].end;
}

/** 勤続年数: 1年未満の端数は切り上げ。ちょうど N 年なら N。 */
export function serviceYearsFromMonths(months: number): number {
  if (months <= 0) return 0;
  const rem = months % 12;
  const years = Math.floor(months / 12);
  return rem === 0 ? years : years + 1;
}

/** 重複年数: 1年未満の端数は切り捨て。 */
export function overlapYearsFromMonths(months: number): number {
  if (months <= 0) return 0;
  return Math.floor(months / 12);
}

/**
 * 初日から N 年分の暦窓。開始月を1か月目として N×12 か月。
 * N=0 は空（docs/tax-source-notes.md 2.4 の文言読み。公式設例なし）。
 */
export function calendarWindowFromStart(
  start: YearMonth,
  nYears: number,
): MonthInterval | null {
  if (nYears <= 0) return null;
  const end = fromMonthIndex(toMonthIndex(start) + nYears * 12 - 1);
  return { start, end };
}

export function clipFromStart(
  intervals: MonthInterval[],
  nYears: number,
): MonthInterval[] {
  const start = earliestStart(intervals);
  if (!start) return [];
  const window = calendarWindowFromStart(start, nYears);
  if (!window) return [];
  return intersectIntervals(intervals, [window]);
}

/**
 * 簡易入力の仮置き。終了は受取年の12月、開始は (受取年 − 年数 + 1) 年1月。
 * 法令の復元規則ではない（docs/tax-source-notes.md 3.4）。
 */
export function reconstructSimpleInterval(
  serviceYears: number,
  receiptYear: number,
): MonthInterval {
  if (serviceYears <= 0) {
    throw new Error("勤続年数は1年以上にしてください");
  }
  return {
    start: { year: receiptYear - serviceYears + 1, month: 1 },
    end: { year: receiptYear, month: 12 },
  };
}
