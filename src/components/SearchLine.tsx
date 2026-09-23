"use client";

import { Text } from "@mantine/core";
import { valleyYears, type LinePoint } from "@/lib/chart-data";

function compactYen(yen: number): string {
  if (yen >= 10_000) return `${Math.round(yen / 10_000)}万`;
  return String(yen);
}

export function SearchLine({ axisLabel, points }: { axisLabel: string; points: LinePoint[] }) {
  if (points.length === 0) return null;
  const valleys = new Set(valleyYears(points));
  const years = points.map((point) => point.year);
  const taxes = points.map((point) => point.taxYen);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minTax = Math.min(...taxes);
  const maxTax = Math.max(...taxes);
  const pad = { left: 52, right: 12, top: 16, bottom: 28 };
  const width = 320;
  const height = 160;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xOf = (year: number) =>
    pad.left + (maxYear === minYear ? innerW / 2 : ((year - minYear) / (maxYear - minYear)) * innerW);
  const yOf = (tax: number) =>
    pad.top + (maxTax === minTax ? innerH / 2 : (1 - (tax - minTax) / (maxTax - minTax)) * innerH);
  const d = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xOf(point.year).toFixed(1)} ${yOf(point.taxYen).toFixed(1)}`)
    .join(" ");

  return (
    <div className="line-chart">
      <Text size="sm" c="dimmed" mb={6}>
        横軸は{axisLabel}、縦軸は税額です。下が谷です。
      </Text>
      <svg
        className="line-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${axisLabel}と税額の折れ線`}
      >
        <line
          className="chart-axis"
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={height - pad.bottom}
        />
        <line
          className="chart-axis"
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
        />
        <line
          className="chart-valley"
          x1={pad.left}
          y1={yOf(minTax)}
          x2={width - pad.right}
          y2={yOf(minTax)}
        />
        <path className="chart-line" d={d} />
        {points.map((point) => (
          <circle
            key={point.year}
            className={valleys.has(point.year) ? "chart-dot is-valley" : "chart-dot"}
            cx={xOf(point.year)}
            cy={yOf(point.taxYen)}
            r={valleys.has(point.year) ? 4.5 : 3}
            aria-label={`${point.year}年 ${point.taxYen.toLocaleString("ja-JP")}円`}
          />
        ))}
        <text className="chart-label" x={4} y={pad.top + 10}>
          {compactYen(maxTax)}
        </text>
        <text className="chart-label" x={4} y={height - pad.bottom}>
          {compactYen(minTax)}
        </text>
        <text className="chart-label" x={pad.left} y={height - pad.bottom + 14}>
          {minYear}
        </text>
        <text className="chart-label" x={width - pad.right} y={height - pad.bottom + 14} textAnchor="end">
          {maxYear}
        </text>
      </svg>
    </div>
  );
}
