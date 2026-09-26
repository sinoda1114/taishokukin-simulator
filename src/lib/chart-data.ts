import { defaultRuleset, type BenefitInput, type SearchHit } from "@/engine";
import { KIND_LABELS } from "./parse-input";

export type LinePoint = {
  age: number;
  year: number;
  taxYen: number;
  detail: string;
};

export type SearchLineModel = {
  axisLabel: string;
  axisMin: number;
  axisMax: number;
  points: LinePoint[];
  optimizedPoints: LinePoint[] | null;
};

export function chartScale(
  value: number,
  min: number,
  max: number,
  start: number,
  size: number,
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !Number.isFinite(start) ||
    !Number.isFinite(size)
  ) {
    return start;
  }
  if (max === min) return start + size / 2;
  return start + ((value - min) / (max - min)) * size;
}

function benefitCaption(id: string, year: number, benefits: BenefitInput[]): string {
  const index = benefits.findIndex((benefit) => benefit.id === id);
  const benefit = index >= 0 ? benefits[index] : undefined;
  const name = benefit ? KIND_LABELS[benefit.kind] : id;
  const clash = benefit !== undefined && benefits.filter((item) => item.kind === benefit.kind).length > 1;
  return `${name}${clash ? ` ${index + 1}` : ""} ${year}年`;
}

function otherDetail(hit: SearchHit, benefits: BenefitInput[], primaryId: string): string {
  return Object.entries(hit.receiptYears)
    .filter(([id]) => id !== primaryId)
    .map(([id, year]) => benefitCaption(id, year, benefits))
    .join("、");
}

function lowestByAge(
  hits: SearchHit[],
  benefits: BenefitInput[],
  primaryId: string,
  birthYear: number,
): LinePoint[] {
  const byAge = new Map<number, LinePoint>();
  for (const hit of hits) {
    const tax = hit.result.totalTaxYen;
    const year = hit.receiptYears[primaryId];
    if (tax === null || year === undefined) continue;
    const age = year - birthYear;
    if (age < defaultRuleset.dcReceiptAgeMin || age > defaultRuleset.dcReceiptAgeMax) continue;
    const point: LinePoint = { age, year, taxYen: tax, detail: otherDetail(hit, benefits, primaryId) };
    const previous = byAge.get(age);
    if (!previous || tax < previous.taxYen) byAge.set(age, point);
  }
  return [...byAge.values()].sort((left, right) => left.age - right.age);
}

export function searchLinePoints(
  hits: SearchHit[],
  benefits: BenefitInput[],
  birthYear: number,
): SearchLineModel {
  const empty: SearchLineModel = {
    axisLabel: "iDeCo・企業型DC一時金の受取年齢",
    axisMin: defaultRuleset.dcReceiptAgeMin,
    axisMax: defaultRuleset.dcReceiptAgeMax,
    points: [],
    optimizedPoints: null,
  };
  if (hits.length === 0 || !Number.isFinite(birthYear)) return empty;
  const ids = Object.keys(hits[0]?.receiptYears ?? {});
  const primary =
    benefits.find((benefit) => benefit.kind === "dc" && benefit.optimizeReceiptYear && ids.includes(benefit.id)) ??
    benefits.find((benefit) => benefit.kind === "dc" && ids.includes(benefit.id));
  if (!primary) return empty;
  const othersVary = ids.some((id) => {
    if (id === primary.id) return false;
    return new Set(hits.map((hit) => hit.receiptYears[id])).size > 1;
  });
  const fixedHits = hits.filter((hit) =>
    benefits.every((benefit) => {
      if (benefit.id === primary.id) return true;
      const year = hit.receiptYears[benefit.id];
      return year === undefined || year === benefit.receiptYear;
    }),
  );
  const points = lowestByAge(fixedHits.length > 0 ? fixedHits : hits, benefits, primary.id, birthYear);
  const optimizedPoints = othersVary ? lowestByAge(hits, benefits, primary.id, birthYear) : null;
  return {
    axisLabel: `${KIND_LABELS[primary.kind]}の受取年齢`,
    axisMin: defaultRuleset.dcReceiptAgeMin,
    axisMax: defaultRuleset.dcReceiptAgeMax,
    points,
    optimizedPoints,
  };
}

export function valleyAges(points: LinePoint[]): number[] {
  if (points.length === 0) return [];
  const min = Math.min(...points.map((point) => point.taxYen));
  return points.filter((point) => point.taxYen === min).map((point) => point.age);
}
