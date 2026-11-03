/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it } from "vitest";
import { containerUsesGpu, nodeHasGpu, podHasGpu, workloadHasGpu } from "../gpu-presence";

const gpu = { "nvidia.com/gpu": "1" };

describe("nodeHasGpu", () => {
  it("is true when the node advertises GPUs", () => {
    expect(nodeHasGpu({ status: { capacity: { cpu: "8", "nvidia.com/gpu": "4" } } })).toBe(true);
  });

  it.each([
    ["no GPUs", { status: { capacity: { "nvidia.com/gpu": "0" } } }],
    ["no GPU entry", { status: { capacity: { cpu: "8" } } }],
    ["no capacity", { status: {} }],
    ["no status", {}],
    ["null", null],
    ["undefined", undefined],
  ])("is false for a node with %s", (_name, node) => {
    expect(nodeHasGpu(node)).toBe(false);
  });
});

describe("podHasGpu", () => {
  it("is true when a container requests or limits GPUs", () => {
    expect(podHasGpu({ spec: { containers: [{ resources: { requests: gpu } }] } })).toBe(true);
    expect(podHasGpu({ spec: { containers: [{}, { resources: { limits: gpu } }] } })).toBe(true);
  });

  it.each([
    ["other resources", { spec: { containers: [{ resources: { limits: { cpu: "1" } } }] } }],
    ["no resources", { spec: { containers: [{}] } }],
    ["no containers", { spec: { containers: [] } }],
    ["no spec", {}],
    ["null", null],
  ])("is false for a pod with %s", (_name, pod) => {
    expect(podHasGpu(pod)).toBe(false);
  });

  it("looks at containers, not at a pod template", () => {
    expect(podHasGpu({ spec: { template: { spec: { containers: [{ resources: { limits: gpu } }] } } } })).toBe(false);
  });
});

describe("workloadHasGpu", () => {
  it("is true when a container of the pod template requests or limits GPUs", () => {
    const template = (resources: object) => ({ spec: { template: { spec: { containers: [{ resources }] } } } });

    expect(workloadHasGpu(template({ limits: gpu }))).toBe(true);
    expect(workloadHasGpu(template({ requests: gpu }))).toBe(true);
  });

  it.each([
    ["other resources", { spec: { template: { spec: { containers: [{ resources: { limits: { cpu: "1" } } }] } } } }],
    ["no template", { spec: {} }],
    ["no spec", {}],
    ["undefined", undefined],
  ])("is false for a workload with %s", (_name, workload) => {
    expect(workloadHasGpu(workload)).toBe(false);
  });
});

describe("containerUsesGpu", () => {
  it("handles containers without resources", () => {
    expect(containerUsesGpu(undefined)).toBe(false);
    expect(containerUsesGpu({ resources: null })).toBe(false);
    expect(containerUsesGpu({ resources: { requests: null, limits: undefined } })).toBe(false);
  });
});
