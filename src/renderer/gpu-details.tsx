/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { observer } from "mobx-react";
import React from "react";
import { DetailCharts } from "./detail-charts";
import { type GpuPresenceSubject, nodeHasGpu, podHasGpu, workloadHasGpu } from "./gpu-presence";
import { type DetailTarget, detailQueriesFor, type TargetKind } from "./gpu-targets";
import { RangeSelector } from "./range-selector";
import { ensureStyles } from "./styles";
import { detailRanges, type RangeKey } from "./time-range";
import { usePolledMetrics } from "./use-polled-metrics";

type KubeObject = Renderer.K8sApi.KubeObject;
type DetailsProps<T extends KubeObject = KubeObject> = Renderer.Component.KubeObjectDetailsProps<T>;
type AtLeastOneMetricTab = Renderer.Component.AtLeastOneMetricTab;

const { DrawerTitle, ResourceMetrics } = Renderer.Component;

// The tab union of ResourceMetrics is closed over the built-in tabs; the host renders any label.
const gpuTabs = ["GPU", "GPU Memory"] as unknown as AtLeastOneMetricTab;

interface BlockProps {
  object: KubeObject;
  target: DetailTarget;
  /** Keep the pod list of the cluster loaded and current while the block is open. */
  watchPods?: boolean;
}

/** The GPU charts of one object: a range selector over a `ResourceMetrics` with the GPU tabs. */
function GpuMetricsBlock({ object, target, watchPods }: BlockProps) {
  ensureStyles();

  const [range, setRange] = React.useState<RangeKey>("1h");
  const { status, metrics, span } = usePolledMetrics(detailQueriesFor(target), range, target.namespace);

  React.useEffect(() => {
    if (!watchPods) return;

    try {
      return Renderer.K8sApi.podsStore.subscribe();
    } catch {
      // The pod list is only used to name the pods; the generated-name pattern covers without it.
    }
  }, [watchPods]);

  return (
    <div className="GpuChartsDetails">
      <DrawerTitle>GPU</DrawerTitle>
      <div className="GpuChartsDetailsRange">
        <RangeSelector ranges={detailRanges} value={range} onChange={setRange} />
      </div>
      <ResourceMetrics tabs={gpuTabs} object={object} metrics={metrics}>
        <DetailCharts kind={target.kind === "Node" ? "node" : "pod"} span={span} loading={status === "loading"} />
      </ResourceMetrics>
    </div>
  );
}

/** Wraps the check and the target of a kind into a details component that renders nothing without GPUs. */
function detailsFor<T extends KubeObject>(
  kind: TargetKind,
  hasGpu: (object: GpuPresenceSubject) => boolean,
  podNamesOf?: (object: T) => string[],
) {
  return observer(({ object }: DetailsProps<T>) => {
    if (!hasGpu(object as unknown as GpuPresenceSubject)) return null;

    const target: DetailTarget = {
      kind,
      name: object.getName(),
      namespace: kind === "Node" ? undefined : object.getNs(),
      podNames: podNamesOf?.(object),
    };

    return <GpuMetricsBlock object={object} target={target} watchPods={Boolean(podNamesOf)} />;
  });
}

const podNames = (pods: Renderer.K8sApi.Pod[]) => pods.map((pod) => pod.getName());
const ownedPods = (object: KubeObject) => podNames(Renderer.K8sApi.podsStore.getPodsByOwnerId(object.getId()));

export const NodeGpuDetails = detailsFor<Renderer.K8sApi.Node>("Node", nodeHasGpu);
export const PodGpuDetails = detailsFor<Renderer.K8sApi.Pod>("Pod", podHasGpu);
// Pods of a Deployment belong to its ReplicaSets; the store finds them by the pod template labels.
export const DeploymentGpuDetails = detailsFor<Renderer.K8sApi.Deployment>("Deployment", workloadHasGpu, (deployment) =>
  podNames(Renderer.K8sApi.deploymentStore.getChildPods(deployment)),
);
export const StatefulSetGpuDetails = detailsFor<Renderer.K8sApi.StatefulSet>("StatefulSet", workloadHasGpu, ownedPods);
export const DaemonSetGpuDetails = detailsFor<Renderer.K8sApi.DaemonSet>("DaemonSet", workloadHasGpu, ownedPods);
export const JobGpuDetails = detailsFor<Renderer.K8sApi.Job>("Job", workloadHasGpu, ownedPods);
