/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

/**
 * Every PromQL string the extension sends. The shapes follow the GPU queries of the
 * Freelens Prometheus providers, so the charts agree with the built-in ones.
 *
 * Series used:
 *  - dcgm-exporter: DCGM_FI_DEV_GPU_UTIL (0-100 per GPU), DCGM_FI_DEV_FB_USED and
 *    DCGM_FI_DEV_FB_FREE (MiB per GPU), labelled with `Hostname` (the node name) and, with
 *    the exporter's pod mapping on, `pod` / `namespace` / `container` of the owning workload
 *    (`exported_*` when Prometheus scrapes without `honor_labels`).
 *  - kube-state-metrics: kube_node_status_capacity, kube_node_status_allocatable,
 *    kube_pod_container_resource_requests and kube_pod_container_resource_limits with
 *    `resource="nvidia_com_gpu"`.
 */

export const DCGM_UTILIZATION = "DCGM_FI_DEV_GPU_UTIL";
export const DCGM_MEMORY_USED = "DCGM_FI_DEV_FB_USED";
export const DCGM_MEMORY_FREE = "DCGM_FI_DEV_FB_FREE";

const GPU_RESOURCE = `resource="nvidia_com_gpu"`;
const MIB_TO_BYTES = 1048576;

/** Escapes a value for use inside a double-quoted PromQL string. */
export function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Escapes a literal for use inside a regular expression that sits in a double-quoted PromQL string. */
export function escapeRegex(value: string): string {
  return escapeLabelValue(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/** A regex body matching exactly one of the given pod names. */
export function podNameRegex(names: readonly string[]): string {
  return names.map(escapeRegex).join("|");
}

/**
 * Pod-name regexes for the workload kinds, for when the pods themselves are not known:
 * the names Kubernetes generates for the pods each controller creates.
 */
export const workloadPodRegex = {
  deployment: (name: string) => `^${escapeRegex(name)}-[[:alnum:]]{9,}-[[:alnum:]]{5}$`,
  statefulSet: (name: string) => `^${escapeRegex(name)}-[[:digit:]]+$`,
  daemonSet: (name: string) => `^${escapeRegex(name)}-[[:alnum:]]{5}$`,
  job: (name: string) => `^${escapeRegex(name)}-[[:alnum:]]{5}$`,
} as const;

export interface DcgmPodOptions {
  /** Regex body for the pod name, already escaped for a PromQL string. */
  pods: string;
  /** Exact namespace; every namespace when omitted. */
  namespace?: string;
  /** Comma separated labels to group by; the result has no labels when empty. */
  selector?: string;
}

export type Aggregation = "sum" | "avg" | "count";

/**
 * Per-pod series of a dcgm-exporter metric. With the exporter's pod mapping on, the series
 * carry `pod`, `namespace` and `container` of the workload holding the GPU, but a Prometheus
 * scrape without `honor_labels` renames them to `exported_pod`, `exported_namespace` and
 * `exported_container`. Both spellings are queried and the second is renamed back, so the
 * result carries the plain labels. The plain query skips series that also have
 * `exported_pod`: their `pod` is the exporter's own, which would otherwise show the totals of
 * every GPU on its node.
 */
export function dcgmPodQuery(metric: string, opts: DcgmPodOptions, aggregation: Aggregation = "sum"): string {
  const labels = (opts.selector ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const namespace = opts.namespace === undefined ? `namespace=~".+"` : `namespace="${opts.namespace}"`;
  const exportedNamespace =
    opts.namespace === undefined ? `exported_namespace=~".+"` : `exported_namespace="${opts.namespace}"`;
  const plain = `${aggregation}(${metric}{pod=~"${opts.pods}",${namespace},exported_pod=""}) by (${labels.join(", ")})`;
  const exported = `${aggregation}(${metric}{exported_pod=~"${opts.pods}",${exportedNamespace}}) by (${labels
    .map((l) => `exported_${l}`)
    .join(", ")})`;
  const renamed = labels.reduce(
    (expr, label) => `label_replace(${expr}, "${label}", "$1", "exported_${label}", "(.*)")`,
    exported,
  );

  return `${plain} or ${renamed}`;
}

// --- Cluster -------------------------------------------------------------------------------

export const clusterMetricNames = [
  "gpuUsage",
  "gpuAllocatable",
  "gpuCapacity",
  "gpuRequests",
  "gpuMemoryUsage",
  "gpuMemoryCapacity",
] as const;
export type ClusterMetricName = (typeof clusterMetricNames)[number];

export function clusterQueries(): Record<ClusterMetricName, string> {
  return {
    gpuUsage: `sum(${DCGM_UTILIZATION}) / 100`,
    gpuAllocatable: `sum(kube_node_status_allocatable{${GPU_RESOURCE}})`,
    gpuCapacity: `sum(kube_node_status_capacity{${GPU_RESOURCE}})`,
    gpuRequests: `sum(kube_pod_container_resource_requests{${GPU_RESOURCE}})`,
    gpuMemoryUsage: `sum(${DCGM_MEMORY_USED}) * ${MIB_TO_BYTES}`,
    gpuMemoryCapacity: `(sum(${DCGM_MEMORY_USED}) + sum(${DCGM_MEMORY_FREE})) * ${MIB_TO_BYTES}`,
  };
}

// --- Nodes table ---------------------------------------------------------------------------

export const nodeTableMetricNames = [
  "utilization",
  "memoryUsed",
  "memoryTotal",
  "allocatable",
  "capacity",
  "requests",
] as const;
export type NodeTableMetricName = (typeof nodeTableMetricNames)[number];

/** One series per node: `Hostname` for the DCGM metrics, `node` for the kube-state-metrics ones. */
export function nodeTableQueries(): Record<NodeTableMetricName, string> {
  return {
    utilization: `avg(${DCGM_UTILIZATION}) by (Hostname)`,
    memoryUsed: `sum(${DCGM_MEMORY_USED}) by (Hostname) * ${MIB_TO_BYTES}`,
    memoryTotal: `(sum(${DCGM_MEMORY_USED}) by (Hostname) + sum(${DCGM_MEMORY_FREE}) by (Hostname)) * ${MIB_TO_BYTES}`,
    allocatable: `sum(kube_node_status_allocatable{${GPU_RESOURCE}}) by (node)`,
    capacity: `sum(kube_node_status_capacity{${GPU_RESOURCE}}) by (node)`,
    requests: `sum(kube_pod_container_resource_requests{${GPU_RESOURCE}}) by (node)`,
  };
}

// --- Workloads table -----------------------------------------------------------------------

export const podTableMetricNames = ["utilization", "devices", "memoryUsed", "memoryFree"] as const;
export type PodTableMetricName = (typeof podTableMetricNames)[number];

/** One series per (namespace, pod) that holds GPUs, whichever label spelling the scrape produced. */
export function podTableQueries(): Record<PodTableMetricName, string> {
  const opts: DcgmPodOptions = { pods: ".+", selector: "namespace, pod" };

  return {
    utilization: dcgmPodQuery(DCGM_UTILIZATION, opts, "avg"),
    devices: dcgmPodQuery(DCGM_UTILIZATION, opts, "count"),
    memoryUsed: `(${dcgmPodQuery(DCGM_MEMORY_USED, opts)}) * ${MIB_TO_BYTES}`,
    memoryFree: `(${dcgmPodQuery(DCGM_MEMORY_FREE, opts)}) * ${MIB_TO_BYTES}`,
  };
}

/** Every query behind the page, under keys that cannot collide. */
export function pageQueries(): Record<string, string> {
  const queries: Record<string, string> = {};

  for (const [name, query] of Object.entries(clusterQueries())) queries[`cluster.${name}`] = query;
  for (const [name, query] of Object.entries(nodeTableQueries())) queries[`node.${name}`] = query;
  for (const [name, query] of Object.entries(podTableQueries())) queries[`pod.${name}`] = query;

  return queries;
}

// --- Object details ------------------------------------------------------------------------

export const detailMetricNames = [
  "gpuUsage",
  "gpuRequests",
  "gpuLimits",
  "gpuAllocatable",
  "gpuCapacity",
  "gpuMemoryUsage",
  "gpuMemoryCapacity",
] as const;
export type DetailMetricName = (typeof detailMetricNames)[number];

/** The queries of a Node details block: only the metrics a node has. */
export function nodeDetailQueries(node: string): Partial<Record<DetailMetricName, string>> {
  const name = escapeLabelValue(node);
  const hostname = `{Hostname="${name}"}`;

  return {
    gpuUsage: `sum(${DCGM_UTILIZATION}${hostname}) / 100`,
    gpuRequests: `sum(kube_pod_container_resource_requests{${GPU_RESOURCE},node="${name}"})`,
    gpuAllocatable: `sum(kube_node_status_allocatable{${GPU_RESOURCE},node="${name}"})`,
    gpuCapacity: `sum(kube_node_status_capacity{${GPU_RESOURCE},node="${name}"})`,
    gpuMemoryUsage: `sum(${DCGM_MEMORY_USED}${hostname}) * ${MIB_TO_BYTES}`,
    gpuMemoryCapacity: `(sum(${DCGM_MEMORY_USED}${hostname}) + sum(${DCGM_MEMORY_FREE}${hostname})) * ${MIB_TO_BYTES}`,
  };
}

/**
 * The queries of a Pod or workload details block: one series summed over the matched pods.
 * `pods` is a regex body already escaped for a PromQL string (see `podNameRegex`).
 */
export function podDetailQueries(pods: string, namespace: string): Partial<Record<DetailMetricName, string>> {
  const ns = escapeLabelValue(namespace);
  const opts: DcgmPodOptions = { pods, namespace: ns, selector: "" };

  return {
    gpuUsage: `(${dcgmPodQuery(DCGM_UTILIZATION, opts)}) / 100`,
    gpuMemoryUsage: `(${dcgmPodQuery(DCGM_MEMORY_USED, opts)}) * ${MIB_TO_BYTES}`,
    gpuRequests: `sum(kube_pod_container_resource_requests{pod=~"${pods}",${GPU_RESOURCE},namespace="${ns}"}) by ()`,
    gpuLimits: `sum(kube_pod_container_resource_limits{pod=~"${pods}",${GPU_RESOURCE},namespace="${ns}"}) by ()`,
  };
}
