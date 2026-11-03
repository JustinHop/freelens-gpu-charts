/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it } from "vitest";
import { detailDatasets, formatCount, formatPercent, toChartPoints } from "../chart-data";
import { matrix, series } from "./fixtures";

describe("toChartPoints", () => {
  it("turns seconds into milliseconds and samples into numbers", () => {
    expect(
      toChartPoints(
        matrix(
          series({}, [
            [1, "0.25"],
            [2, "3"],
          ]),
        ),
      ),
    ).toEqual([
      { x: 1000, y: 0.25 },
      { x: 2000, y: 3 },
    ]);
  });

  it("has no points for the failure shapes", () => {
    expect(toChartPoints(undefined)).toEqual([]);
    expect(toChartPoints({} as never)).toEqual([]);
  });
});

describe("formatting", () => {
  it("rounds counts to two decimals and percentages to one, without trailing zeros", () => {
    expect(formatCount(3)).toBe("3");
    expect(formatCount(0.456)).toBe("0.46");
    expect(formatPercent(37.5)).toBe("37.5%");
    expect(formatPercent(40)).toBe("40%");
    expect(formatPercent(12.34)).toBe("12.3%");
  });

  it("show N/A for what is not a number", () => {
    expect(formatCount(Number.NaN)).toBe("N/A");
    expect(formatPercent(Number.NaN)).toBe("N/A%");
  });
});

describe("detailDatasets", () => {
  const metrics = {
    gpuUsage: matrix(series({}, [[1, 1]])),
    gpuRequests: matrix(series({}, [[1, 2]])),
    gpuLimits: matrix(series({}, [[1, 3]])),
    gpuAllocatable: matrix(series({}, [[1, 4]])),
    gpuCapacity: matrix(series({}, [[1, 5]])),
    gpuMemoryUsage: matrix(series({}, [[1, 6]])),
    gpuMemoryCapacity: matrix(series({}, [[1, 7]])),
  };
  const labels = (kind: "node" | "pod", tab: "GPU" | "GPU Memory") =>
    detailDatasets(kind, tab, metrics, "obj", "#ccc").map((dataset) => dataset.label);

  it("draws usage, requests, allocatable and capacity for a node", () => {
    expect(labels("node", "GPU")).toEqual(["Usage", "Requests", "Allocatable Capacity", "Capacity"]);
    expect(labels("node", "GPU Memory")).toEqual(["Usage", "Capacity"]);
  });

  it("draws usage, requests and limits for a pod or workload", () => {
    expect(labels("pod", "GPU")).toEqual(["Usage", "Requests", "Limits"]);
    expect(labels("pod", "GPU Memory")).toEqual(["Usage"]);
  });

  it("reads each dataset from its own metric, with numeric points", () => {
    const [usage, requests, limits] = detailDatasets("pod", "GPU", metrics, "obj", "#ccc");

    expect(usage.data).toEqual([{ x: 1000, y: 1 }]);
    expect(requests.data).toEqual([{ x: 1000, y: 2 }]);
    expect(limits.data).toEqual([{ x: 1000, y: 3 }]);
    expect(limits.borderColor).toBe("#ccc");
    expect(usage.id).toBe("obj-gpuUsage");
  });

  it("yields empty datasets for metrics that did not load", () => {
    const datasets = detailDatasets("node", "GPU", {}, "obj", "#ccc");

    expect(datasets).toHaveLength(4);
    expect(datasets.every((dataset) => dataset.data.length === 0)).toBe(true);
  });
});
