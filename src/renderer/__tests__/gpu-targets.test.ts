/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it } from "vitest";
import { detailQueriesFor } from "../gpu-targets";
import { nodeDetailQueries } from "../promql";

describe("detailQueriesFor", () => {
  it("uses the node queries for a node", () => {
    expect(detailQueriesFor({ kind: "Node", name: "gpu-1" })).toEqual(nodeDetailQueries("gpu-1"));
  });

  it("matches a pod by its exact name in its namespace", () => {
    const queries = detailQueriesFor({ kind: "Pod", name: "train.v1-0", namespace: "ml" });

    expect(queries.gpuRequests).toContain('pod=~"train\\\\.v1-0"');
    expect(queries.gpuRequests).toContain('namespace="ml"');
    expect(queries.gpuUsage).toContain('exported_pod=~"train\\\\.v1-0",exported_namespace="ml"');
  });

  it("matches the pods a workload runs by name, sorted", () => {
    const queries = detailQueriesFor({
      kind: "Deployment",
      name: "web",
      namespace: "apps",
      podNames: ["web-b-x1", "web-a-x2"],
    });

    expect(queries.gpuRequests).toContain('pod=~"web-a-x2|web-b-x1"');
  });

  it.each([
    ["Deployment", "^web-[[:alnum:]]{9,}-[[:alnum:]]{5}$"],
    ["StatefulSet", "^web-[[:digit:]]+$"],
    ["DaemonSet", "^web-[[:alnum:]]{5}$"],
    ["Job", "^web-[[:alnum:]]{5}$"],
  ] as const)("falls back to the generated-name pattern of a %s without known pods", (kind, regex) => {
    for (const podNames of [undefined, []]) {
      const queries = detailQueriesFor({ kind, name: "web", namespace: "apps", podNames });

      expect(queries.gpuRequests).toContain(`pod=~"${regex}"`);
      expect(queries.gpuUsage).toContain(`pod=~"${regex}"`);
    }
  });
});
