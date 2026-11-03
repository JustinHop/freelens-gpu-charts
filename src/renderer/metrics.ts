/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import type { Renderer } from "@freelensapp/extensions";

export type MetricData = Renderer.K8sApi.MetricData;
export type MetricResult = Renderer.K8sApi.MetricResult;

/** What `Renderer.K8sApi.requestMetrics` accepts, narrowed to the part this extension uses. */
export interface RequestParams {
  start: number;
  end: number;
  step: number;
  namespace?: string;
}

/**
 * The array form of the host's `requestMetrics`. The host resolves to `{}` instead of
 * rejecting on any failure, and one failing query collapses the whole array to `{}`.
 */
export type RequestMetrics = (queries: string[], params: RequestParams) => Promise<unknown>;

const emptyMetric = (): MetricData => ({ status: "", data: { resultType: "", result: [{ metric: {}, values: [] }] } });

/**
 * A metric that always has a first series to read, without touching the input:
 * `{}`, `undefined` and a result without series all become one empty series.
 */
export function normalizeMetrics(metrics: MetricData | undefined | null): MetricData {
  if (!metrics?.data?.result) return emptyMetric();

  if (metrics.data.result.length === 0) {
    return { ...metrics, data: { ...metrics.data, result: [{ metric: {}, values: [] }] } };
  }

  return metrics;
}

/** The data points of the first series, as `[unix seconds, number]` with unparsable samples dropped. */
export function pointsOf(metrics: MetricData | undefined | null): [number, number][] {
  const values = normalizeMetrics(metrics).data.result[0]?.values ?? [];
  const points: [number, number][] = [];

  for (const [time, raw] of values) {
    const value = Number.parseFloat(raw);

    if (Number.isFinite(value)) points.push([time, value]);
  }

  return points;
}

/** The newest sample of the first series; undefined without one or when it is not a number. */
export function getLastPoint(metrics: MetricData | undefined | null): number | undefined {
  const raw = normalizeMetrics(metrics).data.result[0]?.values?.at(-1)?.[1];
  const value = Number.parseFloat(raw ?? "");

  return Number.isFinite(value) ? value : undefined;
}

/** The newest data point of the first series of each metric; metrics without a point are left out. */
export function getMetricLastPoints<Keys extends string>(
  metrics: Partial<Record<Keys, MetricData>>,
): Partial<Record<Keys, number>> {
  const result: Partial<Record<Keys, number>> = {};

  for (const key of Object.keys(metrics) as Keys[]) {
    const point = getLastPoint(metrics[key]);

    if (point !== undefined) result[key] = point;
  }

  return result;
}

/**
 * True when no metric holds a data point. A series without points counts as empty, which
 * the host's own check does not: it only looks at the number of series.
 */
export function isMetricsEmpty(metrics: Partial<Record<string, MetricData | undefined>> | null | undefined): boolean {
  return Object.values(metrics ?? {}).every(
    (metric) => !metric?.data?.result?.some((series) => (series?.values?.length ?? 0) > 0),
  );
}

/**
 * The newest sample of every series, grouped under the key `keyOf` derives from its labels.
 * Series without a key or without a numeric newest sample are left out, and so are series that
 * ended before `notBefore` (unix seconds): over a long range a query also returns what no
 * longer exists, and the tables show only what is there now.
 */
export function lastPointsBy(
  metrics: MetricData | undefined | null,
  keyOf: (labels: MetricResult["metric"]) => string | undefined,
  notBefore = Number.NEGATIVE_INFINITY,
): Map<string, number[]> {
  const byKey = new Map<string, number[]>();

  for (const series of metrics?.data?.result ?? []) {
    const key = keyOf(series.metric ?? {});
    const last = series.values?.at(-1);
    const point = Number.parseFloat(last?.[1] ?? "");

    if (!key || !last || last[0] < notBefore || !Number.isFinite(point)) continue;

    byKey.set(key, [...(byKey.get(key) ?? []), point]);
  }

  return byKey;
}

export interface NamedMetrics<Keys extends string> {
  /** False when the host answered with something other than one result per query. */
  ok: boolean;
  metrics: Partial<Record<Keys, MetricData>>;
}

/**
 * Runs the named queries as one request. The result of a query that has no usable response is
 * left out, so a missing key means "no data".
 */
export async function requestNamed<Keys extends string>(
  request: RequestMetrics,
  queries: Partial<Record<Keys, string>>,
  params: RequestParams,
): Promise<NamedMetrics<Keys>> {
  const names = (Object.keys(queries) as Keys[]).filter((name) => queries[name]);
  let response: unknown;

  try {
    response = await request(
      names.map((name) => queries[name] as string),
      params,
    );
  } catch {
    return { ok: false, metrics: {} };
  }

  if (!Array.isArray(response) || response.length !== names.length) return { ok: false, metrics: {} };

  const metrics: Partial<Record<Keys, MetricData>> = {};

  names.forEach((name, index) => {
    const metric = response[index] as MetricData | undefined;

    if (Array.isArray(metric?.data?.result)) metrics[name] = metric;
  });

  return { ok: true, metrics };
}

/** The metrics whose key starts with `<group>.`, under the key without the prefix. */
export function pickGroup<Name extends string>(
  metrics: Partial<Record<string, MetricData>>,
  group: string,
): Partial<Record<Name, MetricData>> {
  const prefix = `${group}.`;
  const picked: Partial<Record<Name, MetricData>> = {};

  for (const [key, metric] of Object.entries(metrics)) {
    if (key.startsWith(prefix) && metric) picked[key.slice(prefix.length) as Name] = metric;
  }

  return picked;
}
