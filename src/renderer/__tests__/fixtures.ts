/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import type { MetricData, MetricResult } from "../metrics";

/** One series; values are `[unix seconds, sample]` pairs. */
export const series = (metric: Record<string, string>, values: [number, number | string][]): MetricResult => ({
  metric,
  values: values.map(([time, value]) => [time, String(value)]),
});

/** A successful `query_range` response. */
export const matrix = (...result: MetricResult[]): MetricData => ({
  status: "success",
  data: { resultType: "matrix", result },
});

/** The span the table tests run in: samples at 3600 are the newest. */
export const span = { start: 0, end: 3600, step: 60 };
