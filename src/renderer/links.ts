/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";

/** Kube API self links of the objects the views mention; Freelens opens them in its details panel. */
export const nodeLink = (name: string): string => `/api/v1/nodes/${encodeURIComponent(name)}`;

export const podLink = (namespace: string, name: string): string =>
  `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(name)}`;

export function openDetails(selfLink: string): void {
  Renderer.Navigation.showDetails(selfLink, true);
}
