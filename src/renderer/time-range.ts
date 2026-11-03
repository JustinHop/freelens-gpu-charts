/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

export type RangeKey = "1h" | "6h" | "24h" | "7d";

export const pageRanges: readonly RangeKey[] = ["1h", "6h", "24h", "7d"];
export const detailRanges: readonly RangeKey[] = ["1h", "6h", "24h"];

const HOUR = 3600;

const rangeSeconds: Record<RangeKey, number> = {
  "1h": HOUR,
  "6h": 6 * HOUR,
  "24h": 24 * HOUR,
  "7d": 7 * 24 * HOUR,
};

/** Resolution of a range: one minute up to four hours, ten minutes up to a day, an hour beyond. */
export function stepFor(seconds: number): number {
  if (seconds <= 4 * HOUR) return 60;
  if (seconds <= 24 * HOUR) return 600;

  return HOUR;
}

export interface RangeWindow {
  /** Unix seconds. */
  start: number;
  /** Unix seconds. */
  end: number;
  /** Seconds between samples. */
  step: number;
}

/** The `query_range` window that ends at `nowSeconds` and reaches back over `key`. */
export function rangeWindow(key: RangeKey, nowSeconds: number): RangeWindow {
  const seconds = rangeSeconds[key];
  const end = Math.floor(nowSeconds);

  return { start: end - seconds, end, step: stepFor(seconds) };
}
