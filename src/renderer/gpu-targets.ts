/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { type DetailMetricName, nodeDetailQueries, podDetailQueries, podNameRegex, workloadPodRegex } from "./promql";

export type TargetKind = "Node" | "Pod" | "Deployment" | "StatefulSet" | "DaemonSet" | "Job";

export interface DetailTarget {
  kind: TargetKind;
  name: string;
  /** Empty for a Node. */
  namespace?: string;
  /** The pods the workload runs now; the generated-name pattern of the kind stands in when unknown. */
  podNames?: readonly string[];
}

const fallbackRegex = {
  Deployment: workloadPodRegex.deployment,
  StatefulSet: workloadPodRegex.statefulSet,
  DaemonSet: workloadPodRegex.daemonSet,
  Job: workloadPodRegex.job,
};

/** The queries behind the GPU block of an object's details. */
export function detailQueriesFor(target: DetailTarget): Partial<Record<DetailMetricName, string>> {
  const { kind, name, namespace = "", podNames = [] } = target;

  if (kind === "Node") return nodeDetailQueries(name);
  if (kind === "Pod") return podDetailQueries(podNameRegex([name]), namespace);

  const pods = podNames.length ? podNameRegex([...podNames].sort()) : fallbackRegex[kind](name);

  return podDetailQueries(pods, namespace);
}
