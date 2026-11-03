/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

/** The extended resource the NVIDIA device plugin advertises. */
export const GPU_RESOURCE_NAME = "nvidia.com/gpu";

type ResourceMap = Record<string, unknown> | undefined | null;

interface ContainerLike {
  resources?: { requests?: ResourceMap; limits?: ResourceMap } | null;
}

interface PodSpecLike {
  containers?: ContainerLike[] | null;
}

/** The part of a Node, Pod or workload object that presence checks read; real kube objects satisfy it. */
export interface GpuPresenceSubject {
  status?: { capacity?: ResourceMap } | null;
  spec?: (PodSpecLike & { template?: { spec?: PodSpecLike | null } | null }) | null;
}

function hasGpuEntry(resources: ResourceMap): boolean {
  return Boolean(resources) && Object.hasOwn(resources as object, GPU_RESOURCE_NAME);
}

/** A container that asks for GPUs, in its requests or its limits. */
export function containerUsesGpu(container: ContainerLike | undefined | null): boolean {
  return hasGpuEntry(container?.resources?.requests) || hasGpuEntry(container?.resources?.limits);
}

/** A node that advertises at least one GPU. */
export function nodeHasGpu(node: GpuPresenceSubject | undefined | null): boolean {
  const capacity = node?.status?.capacity?.[GPU_RESOURCE_NAME];

  return capacity !== undefined && capacity !== null && String(capacity) !== "0";
}

/** A pod with a container that asks for GPUs. */
export function podHasGpu(pod: GpuPresenceSubject | undefined | null): boolean {
  return Boolean(pod?.spec?.containers?.some(containerUsesGpu));
}

/** A workload (Deployment, StatefulSet, DaemonSet, Job) whose pod template asks for GPUs. */
export function workloadHasGpu(workload: GpuPresenceSubject | undefined | null): boolean {
  return Boolean(workload?.spec?.template?.spec?.containers?.some(containerUsesGpu));
}
