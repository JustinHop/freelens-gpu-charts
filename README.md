# Freelens GPU Charts

A Freelens extension that charts NVIDIA GPU utilization and VRAM, for the whole cluster, per node and per workload,
with history charts that look and behave like the built-in CPU, Memory, Disk and Pods charts.

It runs in the renderer only. It has no main process part, no cluster-side component and no extra RBAC: the queries go
through the same Prometheus connection Freelens uses for its built-in charts.

## What it shows

### The "GPU Charts" page

A cluster page, opened from the "GPU Charts" entry in the cluster sidebar. A time range selector (1h, 6h, 24h, 7d) at
the top drives everything on the page. Data is reloaded every 60 seconds while the page is open.

- Two history charts: "GPU usage" (GPUs busy, that is the utilization of all GPUs added up, against the allocatable GPU
  count) and "GPU memory usage" (bytes in use, against the total VRAM). The "No GPU metrics" placeholder takes their
  place when kube-state-metrics reports no GPU capacity.
- A Nodes table: node, GPUs (allocatable), GPU (mean utilization of the node's GPUs), GPU Memory (used out of total
  VRAM) and Requested (GPUs requested by the pods on the node). Every column is sortable. Nodes appear when
  kube-state-metrics reports `nvidia.com/gpu` capacity for them. A node without DCGM series shows N/A, never 0%. The
  node name opens the node's details.
- A Workloads table of the pods that hold GPUs right now: namespace, pod, GPUs (number of DCGM series for the pod), GPU
  (mean utilization) and GPU Memory (used out of used plus free VRAM of those GPUs), busiest first. The pod name opens
  the pod's details.

The tables show what exists at the end of the selected range: a series counts as current when its newest sample is no
older than two steps.

### GPU blocks in object details

Directly under the built-in metrics block, the details of these objects get a "GPU" block with a "GPU" and a "GPU
Memory" tab and its own 1h, 6h, 24h range selector:

| Object                          | Shown when                                                       | GPU tab                                  | GPU Memory tab    |
| ------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- | ----------------- |
| Node                            | `status.capacity["nvidia.com/gpu"]` is present and not `0`        | usage, requests, allocatable, capacity   | usage, capacity   |
| Pod                             | a container has `nvidia.com/gpu` in its requests or limits        | usage, requests, limits                  | usage             |
| Deployment, StatefulSet, DaemonSet, Job | a container of the pod template has `nvidia.com/gpu` in its requests or limits | usage, requests, limits, summed over the pods | usage    |

For a workload the pods are looked up in the pod list Freelens keeps (for a Deployment through its pod template labels,
for the others through the owner reference). If the pod list is not available, the pods are matched by the names
Kubernetes generates for the controller instead.

## Requirements

- Freelens 1.10 or newer (extension API 1.10).
- Prometheus configured for the cluster in Freelens, exactly as for the built-in charts (cluster settings, Metrics).
- dcgm-exporter scraped by that Prometheus: `DCGM_FI_DEV_GPU_UTIL`, `DCGM_FI_DEV_FB_USED` and `DCGM_FI_DEV_FB_FREE`,
  with the `Hostname` label set to the node name. For the per-pod views the exporter's Kubernetes pod mapping has to be
  on, so that the series carry `pod`, `namespace` and `container`. A scrape that does not honor labels renames them to
  `exported_pod`, `exported_namespace` and `exported_container`; both spellings are understood.
- kube-state-metrics scraped by the same Prometheus: `kube_node_status_capacity`, `kube_node_status_allocatable`,
  `kube_pod_container_resource_requests` and `kube_pod_container_resource_limits`, with the `node`, `pod` and
  `namespace` labels it exports.

Nothing else is needed on the cluster.

## Install

Build the package (see below) or take a released `freelens-gpu-charts-<version>.tgz`. In Freelens open Extensions,
enter the absolute path of the `.tgz` in the install field and install it. Freelens runs `pnpm install --prod` on the
package; the extension has no runtime dependencies, everything it needs is in the bundle or provided by Freelens itself.

## Development

Needs Node 22 or newer and pnpm (the version is pinned in `packageManager`).

```sh
pnpm install
pnpm lint          # biome
pnpm type:check
pnpm test          # unit tests
pnpm build         # type check, bundle, and the bundle smoke test
pnpm pack:tgz      # freelens-gpu-charts-<version>.tgz in the project directory
```

The bundle is a single CommonJS file, `out/renderer/index.js`. The libraries Freelens provides are not bundled: imports
of `@freelensapp/extensions`, `react`, `react/jsx-runtime`, `react-dom`, `react-router`, `react-router-dom`, `mobx` and
`mobx-react` are mapped to the globals the host defines (`LensExtensions`, `React`, `ReactJsxRuntime`, `ReactDOM`,
`ReactRouter`, `ReactRouterDom`, `Mobx`, `MobxReact`). The stylesheet is part of the bundle and is added to the page the
first time one of the views renders, because Freelens loads the renderer file only.

`pnpm build` finishes with a smoke test that loads the built bundle in jsdom with the host's globals in place. It
catches a mapping that lets a library into the bundle a second time, which fails at runtime with errors such as "Invalid
hook call", and it renders the page and the details blocks against a stubbed host.

### Layout

```text
src/renderer/index.tsx          the extension class: page, sidebar entry, six detail registrations
src/renderer/promql.ts          every PromQL string
src/renderer/metrics.ts         response helpers and the batch request
src/renderer/aggregate.ts       rows of the Nodes and Workloads tables
src/renderer/gpu-presence.ts    which nodes, pods and workloads have GPUs
src/renderer/gpu-targets.ts     the queries behind an object's details block
src/renderer/gpu-charts.css     styles, global classes prefixed GpuCharts
src/renderer/__tests__/         unit tests and the bundle smoke test
```

## Known limits

- NVIDIA only: the data comes from dcgm-exporter and the `nvidia.com/gpu` resource.
- DCGM's `Hostname` label has to equal the Kubernetes node name. Where it does not, a node's GPU and GPU Memory columns
  show N/A.
- With MIG, every slice is a DCGM series: utilization is averaged per slice, and the GPUs column of a pod counts slices.
  Requests and limits are only read for `nvidia.com/gpu`, not for MIG resource names.
- Without Prometheus honor_labels, a GPU that no pod holds is reported by Prometheus under the dcgm-exporter pod, so
  that pod can show up in the Workloads table.
- "Requested" is the sum of `kube_pod_container_resource_requests` for the node, as kube-state-metrics reports it.
- The time range selectors are separate from the built-in one in the cluster overview and in the details panels.
- The queries are range queries over the selected range. If one query of the page fails, Freelens answers the whole
  batch with nothing, and the page says it could not load GPU metrics.
