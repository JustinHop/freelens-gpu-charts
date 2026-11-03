/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";

const { Icon } = Renderer.Component;

/** The sidebar icon of the GPU Charts page. */
export function GpuIcon(props: Renderer.Component.IconProps) {
  return <Icon {...props} material="memory" />;
}
