/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { formatCount, MEMORY_COLOR, toChartPoints, USAGE_COLOR } from "./chart-data";
import { gpuCountOptions, gpuMemoryOptions } from "./chart-options";
import { formatBytes } from "./format";
import { getLastPoint, isMetricsEmpty, type MetricData } from "./metrics";
import { NoGpuMetrics } from "./no-gpu-metrics";

import type { ClusterMetricName } from "./promql";
import type { RangeWindow } from "./time-range";

const { BarChart } = Renderer.Component;

export interface ClusterChartsProps {
  metrics: Partial<Record<ClusterMetricName, MetricData>>;
  span: RangeWindow | undefined;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="GpuChartsStat">
      <span className="GpuChartsStatLabel">{label}</span>
      <span className="GpuChartsStatValue">{value}</span>
    </div>
  );
}

/** The cluster-wide history charts, with the current numbers above them. */
export function ClusterCharts({ metrics, span }: ClusterChartsProps) {
  // The capacity series says whether the cluster has GPUs at all.
  if (isMetricsEmpty({ allocatable: metrics.gpuAllocatable, capacity: metrics.gpuCapacity })) {
    return (
      <div className="GpuChartsCard">
        <NoGpuMetrics message="No GPU metrics: kube-state-metrics reports no nvidia.com/gpu capacity for this cluster" />
      </div>
    );
  }

  const allocatable = getLastPoint(metrics.gpuAllocatable) ?? getLastPoint(metrics.gpuCapacity);
  const requests = getLastPoint(metrics.gpuRequests);
  const busy = getLastPoint(metrics.gpuUsage);
  const memoryUsed = getLastPoint(metrics.gpuMemoryUsage);
  const memoryTotal = getLastPoint(metrics.gpuMemoryCapacity);
  const range = { minTime: span?.start, maxTime: span?.end };

  return (
    <>
      <div className="GpuChartsSummary">
        <Stat label="GPUs allocatable" value={allocatable === undefined ? "N/A" : formatCount(allocatable)} />
        <Stat label="GPUs requested" value={requests === undefined ? "N/A" : formatCount(requests)} />
        <Stat label="GPUs busy" value={busy === undefined ? "N/A" : formatCount(busy)} />
        <Stat
          label="VRAM used"
          value={
            memoryUsed === undefined || !memoryTotal
              ? "N/A"
              : `${formatBytes(memoryUsed)} / ${formatBytes(memoryTotal)}`
          }
        />
      </div>
      <div className="GpuChartsCharts">
        <div className="GpuChartsCard">
          <div className="GpuChartsCardTitle">GPU usage</div>
          <BarChart
            name="gpu-charts-cluster-usage"
            className="GpuChartsChart"
            showLegend={false}
            options={gpuCountOptions(allocatable)}
            data={{
              datasets: [
                {
                  id: "gpuUsage",
                  label: "GPU usage",
                  tooltip: "GPUs busy: the utilisation of all GPUs added up, in GPUs",
                  borderColor: USAGE_COLOR,
                  data: toChartPoints(metrics.gpuUsage),
                },
              ],
            }}
            {...range}
          />
        </div>
        <div className="GpuChartsCard">
          <div className="GpuChartsCardTitle">GPU memory usage</div>
          <BarChart
            name="gpu-charts-cluster-memory"
            className="GpuChartsChart"
            showLegend={false}
            options={gpuMemoryOptions(memoryTotal)}
            data={{
              datasets: [
                {
                  id: "gpuMemoryUsage",
                  label: "GPU memory usage",
                  tooltip: "Framebuffer memory in use on all GPUs",
                  borderColor: MEMORY_COLOR,
                  data: toChartPoints(metrics.gpuMemoryUsage),
                },
              ],
            }}
            {...range}
          />
        </div>
      </div>
    </>
  );
}
