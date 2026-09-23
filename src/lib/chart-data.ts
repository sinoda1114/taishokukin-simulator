import type { BenefitInput, SearchHit } from "@/engine";
import { KIND_LABELS } from "./parse-input";

export type LinePoint = { year: number; taxYen: number };

export function searchLinePoints(
  hits: SearchHit[],
  benefits: BenefitInput[],
): { axisLabel: string; points: LinePoint[] } {
  if (hits.length === 0) return { axisLabel: "受取年", points: [] };
  const ids = Object.keys(hits[0]?.receiptYears ?? {});
  const optimized = benefits.find((benefit) => benefit.optimizeReceiptYear && ids.includes(benefit.id));
  let bestId = optimized?.id ?? "";
  if (!bestId) {
    let bestCount = -1;
    for (const id of ids) {
      const unique = new Set(hits.map((hit) => hit.receiptYears[id])).size;
      const kind = benefits.find((benefit) => benefit.id === id)?.kind;
      if (unique > bestCount || (unique === bestCount && kind === "dc")) {
        bestCount = unique;
        bestId = id;
      }
    }
  }
  const byYear = new Map<number, number>();
  for (const hit of hits) {
    const tax = hit.result.totalTaxYen;
    if (tax === null) continue;
    const year = hit.receiptYears[bestId];
    if (year === undefined) continue;
    const previous = byYear.get(year);
    if (previous === undefined || tax < previous) byYear.set(year, tax);
  }
  const benefit = benefits.find((item) => item.id === bestId);
  const name = benefit ? KIND_LABELS[benefit.kind] : "受取年";
  return {
    axisLabel: `${name}の受取年`,
    points: [...byYear.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([year, taxYen]) => ({ year, taxYen })),
  };
}

export function valleyYears(points: LinePoint[]): number[] {
  if (points.length === 0) return [];
  const min = Math.min(...points.map((point) => point.taxYen));
  return points.filter((point) => point.taxYen === min).map((point) => point.year);
}
