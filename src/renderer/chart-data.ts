/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { type MetricData, pointsOf } from "./metrics";

export interface ChartPoint {
  /** Milliseconds, as Chart.js wants them. */
  x: number;
  y: number;
}

/** The first series of a metric as chart points; numbers, so the host's tooltips can format them. */
export function toChartPoints(metrics: MetricData | undefined | null): ChartPoint[] {
  return pointsOf(metrics).map(([time, value]) => ({ x: time * 1000, y: value }));
}

/** A count of GPUs with at most two decimals, without trailing zeros. */
export function formatCount(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "N/A";
}

/** A percentage with at most one decimal, without trailing zeros. */
export function formatPercent(value: number): string {
  return `${Number.isFinite(value) ? Number(value.toFixed(1)) : "N/A"}%`;
}

export interface Dataset {
  id: string;
  label: string;
  tooltip: string;
  borderColor: string;
  data: ChartPoint[];
}

export type DetailKind = "node" | "pod";
export type DetailTab = "GPU" | "GPU Memory";

export const USAGE_COLOR = "#76b900";
export const MEMORY_COLOR = "#f5a623";
const REQUESTS_COLOR = "#2f80ed";
const ALLOCATABLE_COLOR = "#032b4d";

/**
 * The datasets of one tab of a details block: usage, requests and limits for a pod or workload,
 * usage, requests, allocatable and capacity for a node, like the built-in CPU and Memory tabs.
 */
export function detailDatasets(
  kind: DetailKind,
  tab: DetailTab,
  metrics: Partial<Record<string, MetricData>>,
  id: string,
  capacityColor: string,
): Dataset[] {
  const dataset = (key: string, label: string, tooltip: string, borderColor: string): Dataset => ({
    id: `${id}-${key}`,
    label,
    tooltip,
    borderColor,
    data: toChartPoints(metrics[key]),
  });

  if (tab === "GPU Memory") {
    return kind === "node"
      ? [
          dataset("gpuMemoryUsage", "Usage", "GPU memory usage", MEMORY_COLOR),
          dataset("gpuMemoryCapacity", "Capacity", "GPU memory capacity", capacityColor),
        ]
      : [dataset("gpuMemoryUsage", "Usage", "GPU memory usage", MEMORY_COLOR)];
  }

  return kind === "node"
    ? [
        dataset("gpuUsage", "Usage", "GPUs busy", USAGE_COLOR),
        dataset("gpuRequests", "Requests", "GPU requests", REQUESTS_COLOR),
        dataset("gpuAllocatable", "Allocatable Capacity", "GPU allocatable capacity", ALLOCATABLE_COLOR),
        dataset("gpuCapacity", "Capacity", "GPU capacity", capacityColor),
      ]
    : [
        dataset("gpuUsage", "Usage", "GPUs busy", USAGE_COLOR),
        dataset("gpuRequests", "Requests", "GPU requests", REQUESTS_COLOR),
        dataset("gpuLimits", "Limits", "GPU limits", capacityColor),
      ];
}
