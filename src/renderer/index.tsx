/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { GpuChartsPage } from "./gpu-charts-page";
import {
  DaemonSetGpuDetails,
  DeploymentGpuDetails,
  JobGpuDetails,
  NodeGpuDetails,
  PodGpuDetails,
  StatefulSetGpuDetails,
} from "./gpu-details";
import { GpuIcon } from "./gpu-icon";

import type { ComponentType } from "react";

const PAGE_ID = "gpu-charts";

// Details components are written against their own kube object class; the registration is typed for any.
const details = (Details: ComponentType<any>): ComponentType<Renderer.Component.KubeObjectDetailsProps<any>> => Details;

// Directly under the built-in metrics block (-1) and above the meta block (0): the host orders
// detail items by 300 - priority.
const PRIORITY = 300.5;

export default class GpuChartsExtension extends Renderer.LensExtension {
  clusterPages = [{ id: PAGE_ID, components: { Page: GpuChartsPage } }];

  clusterPageMenus = [
    {
      id: PAGE_ID,
      target: { pageId: PAGE_ID },
      title: "GPU Charts",
      components: { Icon: GpuIcon },
    },
  ];

  kubeObjectDetailItems = [
    { kind: "Node", apiVersions: ["v1"], priority: PRIORITY, components: { Details: details(NodeGpuDetails) } },
    { kind: "Pod", apiVersions: ["v1"], priority: PRIORITY, components: { Details: details(PodGpuDetails) } },
    {
      kind: "Deployment",
      apiVersions: ["apps/v1"],
      priority: PRIORITY,
      components: { Details: details(DeploymentGpuDetails) },
    },
    {
      kind: "StatefulSet",
      apiVersions: ["apps/v1"],
      priority: PRIORITY,
      components: { Details: details(StatefulSetGpuDetails) },
    },
    {
      kind: "DaemonSet",
      apiVersions: ["apps/v1"],
      priority: PRIORITY,
      components: { Details: details(DaemonSetGpuDetails) },
    },
    { kind: "Job", apiVersions: ["batch/v1"], priority: PRIORITY, components: { Details: details(JobGpuDetails) } },
  ];
}
