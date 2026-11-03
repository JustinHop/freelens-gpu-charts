/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it, vi } from "vitest";
import {
  getLastPoint,
  getMetricLastPoints,
  isMetricsEmpty,
  lastPointsBy,
  type MetricData,
  normalizeMetrics,
  pickGroup,
  pointsOf,
  requestNamed,
} from "../metrics";
import { matrix, series } from "./fixtures";

/** What the host's route answers when anything went wrong. */
const failure = {} as unknown as MetricData;

describe("normalizeMetrics", () => {
  it("gives the failure shape and nothing a first series to read", () => {
    for (const input of [failure, undefined, null]) {
      expect(normalizeMetrics(input).data.result).toEqual([{ metric: {}, values: [] }]);
    }
  });

  it("adds an empty series to a result without any, without touching the input", () => {
    const input = matrix();
    const output = normalizeMetrics(input);

    expect(output.data.result).toHaveLength(1);
    expect(output.status).toBe("success");
    expect(input.data.result).toHaveLength(0);
  });

  it("returns a metric that has series as it is", () => {
    const input = matrix(series({}, [[1, 1]]));

    expect(normalizeMetrics(input)).toBe(input);
  });
});

describe("pointsOf and getLastPoint", () => {
  it("read the first series as numbers", () => {
    const metric = matrix(
      series({}, [
        [1, "0.5"],
        [2, "2"],
      ]),
    );

    expect(pointsOf(metric)).toEqual([
      [1, 0.5],
      [2, 2],
    ]);
    expect(getLastPoint(metric)).toBe(2);
  });

  it("drop samples that are not numbers and report no last point for one", () => {
    const metric = matrix(
      series({}, [
        [1, "1"],
        [2, "NaN"],
      ]),
    );

    expect(pointsOf(metric)).toEqual([[1, 1]]);
    expect(getLastPoint(metric)).toBeUndefined();
  });

  it("have nothing for the failure shapes", () => {
    expect(getLastPoint(failure)).toBeUndefined();
    expect(getLastPoint(undefined)).toBeUndefined();
    expect(getLastPoint(matrix())).toBeUndefined();
    expect(pointsOf(failure)).toEqual([]);
  });
});

describe("getMetricLastPoints", () => {
  it("keeps the newest point of each metric and leaves out the ones without", () => {
    expect(
      getMetricLastPoints({
        a: matrix(series({}, [[1, 3]])),
        b: matrix(),
        c: failure,
        d: undefined,
      }),
    ).toEqual({ a: 3 });
  });
});

describe("isMetricsEmpty", () => {
  it("is true for no metrics and for every failure shape", () => {
    expect(isMetricsEmpty({})).toBe(true);
    expect(isMetricsEmpty(undefined)).toBe(true);
    expect(isMetricsEmpty({ a: undefined })).toBe(true);
    expect(isMetricsEmpty({ a: failure, b: failure })).toBe(true);
  });

  it("is true for series without data points, which the host's check counts as data", () => {
    expect(isMetricsEmpty({ a: matrix(), b: matrix(series({}, [])) })).toBe(true);
  });

  it("is false as soon as one metric has a data point", () => {
    expect(isMetricsEmpty({ a: matrix(), b: matrix(series({}, [[1, 0]])) })).toBe(false);
  });
});

describe("lastPointsBy", () => {
  const byNode = (labels: Record<string, string | undefined>) => labels.node;

  it("groups the newest samples under the key of their series", () => {
    const metric = matrix(
      series({ node: "a" }, [
        [1, 1],
        [2, 5],
      ]),
      series({ node: "a" }, [[2, 7]]),
      series({ node: "b" }, [[2, 9]]),
    );

    expect(lastPointsBy(metric, byNode)).toEqual(
      new Map([
        ["a", [5, 7]],
        ["b", [9]],
      ]),
    );
  });

  it("leaves out series without a key, without a number and the ones that ended before the cutoff", () => {
    const metric = matrix(
      series({}, [[100, 1]]),
      series({ node: "nan" }, [[100, "NaN"]]),
      series({ node: "gone" }, [[10, 1]]),
      series({ node: "here" }, [[100, 1]]),
    );

    expect([...lastPointsBy(metric, byNode, 50).keys()]).toEqual(["here"]);
  });

  it("is empty for the failure shapes", () => {
    expect(lastPointsBy(failure, byNode).size).toBe(0);
    expect(lastPointsBy(undefined, byNode).size).toBe(0);
  });
});

describe("pickGroup", () => {
  it("returns the metrics of a group under their short names", () => {
    const a = matrix();
    const b = matrix();

    expect(pickGroup({ "cluster.gpuUsage": a, "node.utilization": b }, "cluster")).toEqual({ gpuUsage: a });
  });
});

describe("requestNamed", () => {
  const params = { start: 0, end: 60, step: 60 };
  const queries = { a: "query a", b: "query b" };

  it("sends the queries as one array and hands each result back under its name", async () => {
    const a = matrix(series({}, [[1, 1]]));
    const b = matrix(series({}, [[1, 2]]));
    const request = vi.fn().mockResolvedValue([a, b]);

    await expect(requestNamed(request, queries, params)).resolves.toEqual({ ok: true, metrics: { a, b } });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(["query a", "query b"], params);
  });

  it("reports the object the host answers with when one query fails and collapses the batch", async () => {
    await expect(requestNamed(async () => ({}), queries, params)).resolves.toEqual({ ok: false, metrics: {} });
  });

  it("reports an array of the wrong length, a rejection and a missing answer as failures", async () => {
    await expect(requestNamed(async () => [matrix()], queries, params)).resolves.toEqual({ ok: false, metrics: {} });
    await expect(
      requestNamed(
        async () => {
          throw new Error("boom");
        },
        queries,
        params,
      ),
    ).resolves.toEqual({ ok: false, metrics: {} });
    await expect(requestNamed(async () => undefined, queries, params)).resolves.toEqual({ ok: false, metrics: {} });
  });

  it("leaves out the result of a query that has no usable response", async () => {
    const a = matrix(series({}, [[1, 1]]));
    const result = await requestNamed(async () => [a, {}], queries, params);

    expect(result.ok).toBe(true);
    expect(Object.keys(result.metrics)).toEqual(["a"]);
  });

  it("skips queries without text", async () => {
    const request = vi.fn().mockResolvedValue([matrix()]);

    await requestNamed(request, { a: "query a", b: undefined }, params);
    expect(request).toHaveBeenCalledWith(["query a"], params);
  });
});
