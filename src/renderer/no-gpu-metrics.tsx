/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";

const { Icon } = Renderer.Component;

export interface NoGpuMetricsProps {
  message?: string;
}

/** Shown where a chart or table has nothing to draw. */
export function NoGpuMetrics({ message = "No GPU metrics" }: NoGpuMetricsProps) {
  return (
    <div className="GpuChartsNoMetrics">
      <Icon material="info" />
      <span>{message}</span>
    </div>
  );
}
