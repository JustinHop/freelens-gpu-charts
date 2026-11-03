/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it } from "vitest";
import {
  clusterQueries,
  dcgmPodQuery,
  escapeLabelValue,
  escapeRegex,
  nodeDetailQueries,
  nodeTableQueries,
  pageQueries,
  podDetailQueries,
  podNameRegex,
  podTableQueries,
  workloadPodRegex,
} from "../promql";

const balanced = (query: string) => {
  expect(query.split("{").length, query).toBe(query.split("}").length);
  expect(query.split("(").length, query).toBe(query.split(")").length);
  expect(query.replace(/\\"/g, "").split('"').length % 2, query).toBe(1);
};

describe("cluster queries", () => {
  it("sums the DCGM series and the kube-state-metrics series of the whole cluster", () => {
    expect(clusterQueries()).toEqual({
      gpuUsage: "sum(DCGM_FI_DEV_GPU_UTIL) / 100",
      gpuAllocatable: 'sum(kube_node_status_allocatable{resource="nvidia_com_gpu"})',
      gpuCapacity: 'sum(kube_node_status_capacity{resource="nvidia_com_gpu"})',
      gpuRequests: 'sum(kube_pod_container_resource_requests{resource="nvidia_com_gpu"})',
      gpuMemoryUsage: "sum(DCGM_FI_DEV_FB_USED) * 1048576",
      gpuMemoryCapacity: "(sum(DCGM_FI_DEV_FB_USED) + sum(DCGM_FI_DEV_FB_FREE)) * 1048576",
    });
  });
});

describe("node table queries", () => {
  it("group DCGM by Hostname and kube-state-metrics by node", () => {
    expect(nodeTableQueries()).toEqual({
      utilization: "avg(DCGM_FI_DEV_GPU_UTIL) by (Hostname)",
      memoryUsed: "sum(DCGM_FI_DEV_FB_USED) by (Hostname) * 1048576",
      memoryTotal: "(sum(DCGM_FI_DEV_FB_USED) by (Hostname) + sum(DCGM_FI_DEV_FB_FREE) by (Hostname)) * 1048576",
      allocatable: 'sum(kube_node_status_allocatable{resource="nvidia_com_gpu"}) by (node)',
      capacity: 'sum(kube_node_status_capacity{resource="nvidia_com_gpu"}) by (node)',
      requests: 'sum(kube_pod_container_resource_requests{resource="nvidia_com_gpu"}) by (node)',
    });
  });
});

describe("dcgmPodQuery", () => {
  const metric = "DCGM_FI_DEV_GPU_UTIL";

  it("queries both label spellings and renames the exported labels back", () => {
    expect(dcgmPodQuery(metric, { pods: "web-.*", namespace: "apps", selector: "pod, namespace" })).toBe(
      `sum(${metric}{pod=~"web-.*",namespace="apps",exported_pod=""}) by (pod, namespace) or ` +
        `label_replace(label_replace(sum(${metric}{exported_pod=~"web-.*",exported_namespace="apps"}) ` +
        `by (exported_pod, exported_namespace), "pod", "$1", "exported_pod", "(.*)"), ` +
        `"namespace", "$1", "exported_namespace", "(.*)")`,
    );
  });

  it('keeps the exporter\'s own series off the plain side with exported_pod=""', () => {
    expect(dcgmPodQuery(metric, { pods: "p", namespace: "n", selector: "pod" })).toContain(
      `{pod=~"p",namespace="n",exported_pod=""}`,
    );
  });

  it.each([undefined, "", " , "])("groups by nothing and renames nothing for the selector %j", (selector) => {
    const query = dcgmPodQuery(metric, { pods: "web-.*", namespace: "apps", selector });

    expect(query).toBe(
      `sum(${metric}{pod=~"web-.*",namespace="apps",exported_pod=""}) by () or ` +
        `sum(${metric}{exported_pod=~"web-.*",exported_namespace="apps"}) by ()`,
    );
    expect(query).not.toContain("label_replace");
    expect(query).not.toContain("undefined");
  });

  it("trims the labels of the selector and drops empty ones", () => {
    const query = dcgmPodQuery(metric, { pods: "p", namespace: "n", selector: " namespace , , pod " });

    expect(query).toContain("by (namespace, pod) or ");
    expect(query).toContain("by (exported_namespace, exported_pod)");
  });

  it("matches every namespace when none is given", () => {
    const query = dcgmPodQuery(metric, { pods: ".+", selector: "pod" });

    expect(query).toContain(`{pod=~".+",namespace=~".+",exported_pod=""}`);
    expect(query).toContain(`{exported_pod=~".+",exported_namespace=~".+"}`);
  });

  it.each(["sum", "avg", "count"] as const)("aggregates both sides with %s", (aggregation) => {
    const query = dcgmPodQuery(metric, { pods: "p", namespace: "n", selector: "pod" }, aggregation);

    expect(query.startsWith(`${aggregation}(${metric}{`)).toBe(true);
    expect(query).toContain(` or label_replace(${aggregation}(${metric}{exported_pod`);
  });
});

describe("pod table queries", () => {
  it("aggregate the DCGM series of every pod in every namespace", () => {
    const queries = podTableQueries();

    expect(queries.utilization).toBe(
      'avg(DCGM_FI_DEV_GPU_UTIL{pod=~".+",namespace=~".+",exported_pod=""}) by (namespace, pod) or ' +
        'label_replace(label_replace(avg(DCGM_FI_DEV_GPU_UTIL{exported_pod=~".+",exported_namespace=~".+"}) ' +
        'by (exported_namespace, exported_pod), "namespace", "$1", "exported_namespace", "(.*)"), ' +
        '"pod", "$1", "exported_pod", "(.*)")',
    );
    expect(queries.devices.startsWith('count(DCGM_FI_DEV_GPU_UTIL{pod=~".+",namespace=~".+",exported_pod=""})')).toBe(
      true,
    );
    expect(queries.memoryUsed.startsWith("(sum(DCGM_FI_DEV_FB_USED{")).toBe(true);
    expect(queries.memoryUsed.endsWith(") * 1048576")).toBe(true);
    expect(queries.memoryFree.startsWith("(sum(DCGM_FI_DEV_FB_FREE{")).toBe(true);
  });
});

describe("page queries", () => {
  it("hold the cluster, node and pod queries under distinct keys", () => {
    const keys = Object.keys(pageQueries());

    expect(keys).toHaveLength(16);
    expect(new Set(keys).size).toBe(16);
    expect(keys.filter((k) => k.startsWith("cluster."))).toHaveLength(6);
    expect(keys.filter((k) => k.startsWith("node."))).toHaveLength(6);
    expect(keys.filter((k) => k.startsWith("pod."))).toHaveLength(4);
  });

  it("are well formed", () => {
    for (const query of Object.values(pageQueries())) balanced(query);
  });
});

describe("node detail queries", () => {
  it("filter DCGM by Hostname and kube-state-metrics by node", () => {
    expect(nodeDetailQueries("gpu-1")).toEqual({
      gpuUsage: 'sum(DCGM_FI_DEV_GPU_UTIL{Hostname="gpu-1"}) / 100',
      gpuRequests: 'sum(kube_pod_container_resource_requests{resource="nvidia_com_gpu",node="gpu-1"})',
      gpuAllocatable: 'sum(kube_node_status_allocatable{resource="nvidia_com_gpu",node="gpu-1"})',
      gpuCapacity: 'sum(kube_node_status_capacity{resource="nvidia_com_gpu",node="gpu-1"})',
      gpuMemoryUsage: 'sum(DCGM_FI_DEV_FB_USED{Hostname="gpu-1"}) * 1048576',
      gpuMemoryCapacity:
        '(sum(DCGM_FI_DEV_FB_USED{Hostname="gpu-1"}) + sum(DCGM_FI_DEV_FB_FREE{Hostname="gpu-1"})) * 1048576',
    });
  });

  it("escapes quotes and backslashes in the node name", () => {
    const queries = nodeDetailQueries('we"ird\\node');

    expect(queries.gpuUsage).toBe('sum(DCGM_FI_DEV_GPU_UTIL{Hostname="we\\"ird\\\\node"}) / 100');
    for (const query of Object.values(queries)) balanced(query);
  });
});

describe("pod detail queries", () => {
  const queries = podDetailQueries("web-0|web-1", "apps");

  it("sum the DCGM series of the pods in the namespace, over both label spellings", () => {
    expect(queries.gpuUsage).toBe(
      `(${dcgmPodQuery("DCGM_FI_DEV_GPU_UTIL", { pods: "web-0|web-1", namespace: "apps", selector: "" })}) / 100`,
    );
    expect(queries.gpuMemoryUsage).toBe(
      `(${dcgmPodQuery("DCGM_FI_DEV_FB_USED", { pods: "web-0|web-1", namespace: "apps", selector: "" })}) * 1048576`,
    );
  });

  it("take requests and limits from kube-state-metrics", () => {
    expect(queries.gpuRequests).toBe(
      'sum(kube_pod_container_resource_requests{pod=~"web-0|web-1",resource="nvidia_com_gpu",namespace="apps"}) by ()',
    );
    expect(queries.gpuLimits).toBe(
      'sum(kube_pod_container_resource_limits{pod=~"web-0|web-1",resource="nvidia_com_gpu",namespace="apps"}) by ()',
    );
  });

  it("are well formed", () => {
    for (const query of Object.values(queries)) balanced(query as string);
  });
});

describe("pod name regexes", () => {
  it("escape regex metacharacters, doubling the backslash for the PromQL string", () => {
    expect(escapeRegex("train.v1")).toBe("train\\\\.v1");
    expect(escapeRegex("a+b")).toBe("a\\\\+b");
    expect(escapeLabelValue('a"b')).toBe('a\\"b');
  });

  it("join exact pod names with an alternation", () => {
    expect(podNameRegex(["a.b-0", "a.b-1"])).toBe("a\\\\.b-0|a\\\\.b-1");
    expect(podNameRegex([])).toBe("");
  });

  it("describe the pods each kind of controller generates", () => {
    expect(workloadPodRegex.deployment("web")).toBe("^web-[[:alnum:]]{9,}-[[:alnum:]]{5}$");
    expect(workloadPodRegex.statefulSet("db")).toBe("^db-[[:digit:]]+$");
    expect(workloadPodRegex.daemonSet("agent")).toBe("^agent-[[:alnum:]]{5}$");
    expect(workloadPodRegex.job("train")).toBe("^train-[[:alnum:]]{5}$");
    expect(workloadPodRegex.deployment("my.app")).toBe("^my\\\\.app-[[:alnum:]]{9,}-[[:alnum:]]{5}$");
  });
});
