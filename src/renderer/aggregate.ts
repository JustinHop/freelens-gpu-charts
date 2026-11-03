/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { lastPointsBy, type MetricData } from "./metrics";

import type { NodeTableMetricName, PodTableMetricName } from "./promql";
import type { RangeWindow } from "./time-range";

export interface NodeRow {
  name: string;
  /** Allocatable GPUs; the capacity when kube-state-metrics has no allocatable series for the node. */
  gpus: number;
  /** Mean utilisation of the node's GPUs in percent; undefined when DCGM has no series for the node. */
  utilization?: number;
  memoryUsed?: number;
  memoryTotal?: number;
  /** GPUs requested by the pods on the node. */
  requested: number;
}

export interface PodRow {
  namespace: string;
  name: string;
  /** Number of DCGM series, one per GPU the pod holds. */
  devices?: number;
  /** Mean utilisation of the pod's GPUs in percent. */
  utilization?: number;
  memoryUsed?: number;
  /** Used plus free memory of the GPUs the pod holds. */
  memoryTotal?: number;
}

/** The mean of the values; undefined without any. */
export function mean(values: readonly number[] | undefined): number | undefined {
  return values?.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

/** The sum of the values; undefined without any. */
export function total(values: readonly number[] | undefined): number | undefined {
  return values?.length ? values.reduce((a, b) => a + b, 0) : undefined;
}

/** Series older than this at the end of the window no longer exist. */
const notBeforeOf = (span: RangeWindow) => span.end - 2 * span.step;

const byLabel = (label: string) => (labels: Record<string, string | undefined>) => labels[label] || undefined;

/**
 * One row per node in the capacity series. DCGM series are keyed by `Hostname`, which has to be the
 * node name, and kube-state-metrics series by `node`; a node DCGM has no series for gets no
 * utilisation and memory, which the table shows as N/A rather than as zero. When the same key comes
 * up in several series, utilisation is averaged and memory summed.
 */
export function buildNodeRows(metrics: Partial<Record<NodeTableMetricName, MetricData>>, span: RangeWindow): NodeRow[] {
  const fresh = notBeforeOf(span);
  const kube = (name: NodeTableMetricName) => lastPointsBy(metrics[name], byLabel("node"), fresh);
  const dcgm = (name: NodeTableMetricName) => lastPointsBy(metrics[name], byLabel("Hostname"), fresh);
  const capacity = kube("capacity");
  const allocatable = kube("allocatable");
  const requests = kube("requests");
  const utilization = dcgm("utilization");
  const memoryUsed = dcgm("memoryUsed");
  const memoryTotal = dcgm("memoryTotal");

  return [...capacity.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      gpus: total(allocatable.get(name)) ?? total(capacity.get(name)) ?? 0,
      utilization: mean(utilization.get(name)),
      memoryUsed: total(memoryUsed.get(name)),
      memoryTotal: total(memoryTotal.get(name)),
      requested: total(requests.get(name)) ?? 0,
    }));
}

const SEPARATOR = "\u0000";

/**
 * One row per pod DCGM reports GPUs for, busiest first. Several series for one pod are merged:
 * utilisation is averaged, device counts and memory summed.
 */
export function buildPodRows(metrics: Partial<Record<PodTableMetricName, MetricData>>, span: RangeWindow): PodRow[] {
  const fresh = notBeforeOf(span);
  const keyOf = (labels: Record<string, string | undefined>) =>
    labels.pod && labels.namespace ? `${labels.namespace}${SEPARATOR}${labels.pod}` : undefined;
  const series = (name: PodTableMetricName) => lastPointsBy(metrics[name], keyOf, fresh);
  const utilization = series("utilization");
  const devices = series("devices");
  const memoryUsed = series("memoryUsed");
  const memoryFree = series("memoryFree");
  const keys = new Set([...utilization.keys(), ...devices.keys(), ...memoryUsed.keys(), ...memoryFree.keys()]);

  return [...keys]
    .map((key) => {
      const [namespace, name] = key.split(SEPARATOR);
      const used = total(memoryUsed.get(key));
      const free = total(memoryFree.get(key));

      return {
        namespace,
        name,
        devices: total(devices.get(key)),
        utilization: mean(utilization.get(key)),
        memoryUsed: used,
        memoryTotal: used !== undefined && free !== undefined ? used + free : undefined,
      };
    })
    .sort(
      (a, b) =>
        (b.utilization ?? -1) - (a.utilization ?? -1) ||
        a.namespace.localeCompare(b.namespace) ||
        a.name.localeCompare(b.name),
    );
}
