/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import React from "react";
import { type DetailKind, type DetailTab, detailDatasets } from "./chart-data";
import { gpuCountOptions, gpuMemoryOptions } from "./chart-options";
import { isMetricsEmpty } from "./metrics";
import { NoGpuMetrics } from "./no-gpu-metrics";

import type { RangeWindow } from "./time-range";

const { BarChart, ResourceMetricsContext } = Renderer.Component;

/** Fallback for the theme's capacity color, which the host does not hand to extensions as a constant. */
const DEFAULT_CAPACITY_COLOR = "#4c545f";

function capacityColor(): string {
  try {
    return Renderer.Theme.activeTheme.get().colors.chartCapacityColor || DEFAULT_CAPACITY_COLOR;
  } catch {
    return DEFAULT_CAPACITY_COLOR;
  }
}

export interface DetailChartsProps {
  kind: DetailKind;
  /** The window the metrics were loaded for. */
  span: RangeWindow | undefined;
  /** Nothing is drawn while loading, so that the host's spinner under `ResourceMetrics` shows. */
  loading: boolean;
}

/** The chart of the selected tab of a `ResourceMetrics`, drawn from its context. */
export function DetailCharts({ kind, span, loading }: DetailChartsProps) {
  const { metrics, tab, object } = React.useContext(ResourceMetricsContext) ?? {};

  if (loading || !metrics || !object || !tab) return null;
  if (isMetricsEmpty(metrics)) return <NoGpuMetrics />;

  const gpuTab = tab as DetailTab;
  const datasets = detailDatasets(kind, gpuTab, metrics, object.getId(), capacityColor());

  return (
    <BarChart
      name={`${object.getName()}-gpu-metric-${gpuTab}`}
      options={gpuTab === "GPU Memory" ? gpuMemoryOptions() : gpuCountOptions()}
      data={{ datasets }}
      minTime={span?.start}
      maxTime={span?.end}
    />
  );
}
