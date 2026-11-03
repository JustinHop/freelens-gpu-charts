/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Common } from "@freelensapp/extensions";

/** Bytes in binary units; zero is "0B" where the host's helper says N/A. */
export function formatBytes(bytes: number): string {
  return bytes > 0 ? Common.Util.bytesToUnits(bytes, { precision: 1 }) : "0B";
}
