/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { formatCount } from "./chart-data";

export type ChartOptions = NonNullable<Renderer.Component.BarChartProps["options"]>;

/** The options with the y axis suggested to reach `suggestedMax`; the input is not modified. */
export function withSuggestedMax(base: ChartOptions, suggestedMax: number | undefined): ChartOptions {
  if (!suggestedMax || !Number.isFinite(suggestedMax)) return base;

  const [axis = {}, ...rest] = base.scales?.yAxes ?? [];

  return {
    ...base,
    scales: { ...base.scales, yAxes: [{ ...axis, ticks: { ...axis.ticks, suggestedMax } }, ...rest] },
  };
}

const countOptions: ChartOptions = {
  scales: {
    yAxes: [{ ticks: { callback: (value: number | string) => formatCount(Number(value)) } }],
  },
  tooltips: {
    callbacks: {
      label: ({ datasetIndex, index }, { datasets }) => {
        if (typeof datasetIndex !== "number" || typeof index !== "number" || !datasets) return "";

        const { label, data } = datasets[datasetIndex];
        const point = data?.[index] as { y?: number } | undefined;

        return `${label}: ${formatCount(Number(point?.y))}`;
      },
    },
  },
};

/** A plain number axis, for counts of GPUs. */
export function gpuCountOptions(suggestedMax?: number): ChartOptions {
  return withSuggestedMax(countOptions, suggestedMax);
}

/** The host's byte axis and byte tooltips, for VRAM. */
export function gpuMemoryOptions(suggestedMax?: number): ChartOptions {
  return withSuggestedMax(Renderer.Component.memoryOptions, suggestedMax);
}
