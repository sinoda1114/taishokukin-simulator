"use client";

import { Text } from "@mantine/core";
import { chartScale, valleyAges, type LinePoint } from "@/lib/chart-data";

function compactYen(yen: number): string {
  if (yen >= 10_000) return `${Math.round(yen / 10_000)}万`;
  return String(yen);
}

function pathOf(
  points: Array<LinePoint & { x: number; y: number }>,
): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

export function SearchLine({
  axisLabel,
  axisMin,
  axisMax,
  points,
  optimizedPoints,
}: {
  axisLabel: string;
  axisMin: number;
  axisMax: number;
  points: LinePoint[];
  optimizedPoints: LinePoint[] | null;
}) {
  if (points.length === 0 && (!optimizedPoints || optimizedPoints.length === 0)) return null;
  const drawn = points.length > 0 ? points : (optimizedPoints ?? []);
  const valleys = new Set(valleyAges(drawn));
  const taxes = [...drawn, ...(optimizedPoints ?? [])].map((point) => point.taxYen);
  const minTax = Math.min(...taxes);
  const maxTax = Math.max(...taxes);
  const pad = { left: 52, right: 16, top: 16, bottom: 28 };
  const width = 320;
  const height = 160;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xOf = (age: number) => chartScale(age, axisMin, axisMax, pad.left, innerW);
  const yOf = (tax: number) => pad.top + innerH - chartScale(tax, minTax, maxTax, 0, innerH);
  const place = (series: LinePoint[]) =>
    series
      .map((point) => ({ ...point, x: xOf(point.age), y: yOf(point.taxYen) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const fixed = place(points);
  const optimized = place(optimizedPoints ?? []);
  const fixedPath = fixed.length >= 2 ? pathOf(fixed) : "";
  const optimizedPath = optimized.length >= 2 ? pathOf(optimized) : "";

  return (
    <div className="line-chart">
      <Text size="sm" c="dimmed" mb={6}>
        横軸は{axisLabel}（{axisMin}〜{axisMax}歳）です。縦軸は税額です。
        {optimizedPoints
          ? "実線はほかの受取年を入力のままにした税額、破線は各年齢でほかの受取年も動かした最小です。"
          : "ほかの手当の受取年は入力のままです。"}
      </Text>
      <svg
        className="line-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${axisLabel}と税額の折れ線`}
      >
        <line className="chart-axis" x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} />
        <line
          className="chart-axis"
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
        />
        <line className="chart-valley" x1={pad.left} y1={yOf(minTax)} x2={width - pad.right} y2={yOf(minTax)} />
        {fixedPath ? <path className="chart-line" d={fixedPath} /> : null}
        {optimizedPath ? <path className="chart-line chart-line--opt" d={optimizedPath} /> : null}
        {fixed.map((point) => (
          <circle
            key={`fixed-${point.age}`}
            className={valleys.has(point.age) ? "chart-dot is-valley" : "chart-dot"}
            cx={point.x}
            cy={point.y}
            r={valleys.has(point.age) ? 4.5 : 3}
            aria-label={`${point.age}歳 ${point.year}年 ${point.taxYen.toLocaleString("ja-JP")}円 ${point.detail}`}
          />
        ))}
        {optimized.map((point) => (
          <circle
            key={`opt-${point.age}`}
            className="chart-dot chart-dot--opt"
            cx={point.x}
            cy={point.y}
            r={3}
            aria-label={`${point.age}歳の最小 ${point.year}年 ${point.taxYen.toLocaleString("ja-JP")}円 ${point.detail}`}
          />
        ))}
        <text className="chart-label" x={4} y={pad.top + 10}>
          {compactYen(maxTax)}
        </text>
        <text className="chart-label" x={4} y={height - pad.bottom}>
          {compactYen(minTax)}
        </text>
        <text className="chart-label" x={pad.left} y={height - pad.bottom + 14}>
          {axisMin}歳
        </text>
        <text className="chart-label" x={width - pad.right} y={height - pad.bottom + 14} textAnchor="end">
          {axisMax}歳
        </text>
      </svg>
    </div>
  );
}
