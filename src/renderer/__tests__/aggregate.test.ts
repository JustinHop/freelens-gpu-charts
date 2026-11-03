/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it } from "vitest";
import { buildNodeRows, buildPodRows, mean, total } from "../aggregate";
import { matrix, series, span } from "./fixtures";

const NOW = span.end;
const GiB = 1024 ** 3;

describe("mean and total", () => {
  it("are undefined without values", () => {
    expect(mean([])).toBeUndefined();
    expect(mean(undefined)).toBeUndefined();
    expect(total([])).toBeUndefined();
  });

  it("average and add up", () => {
    expect(mean([20, 60])).toBe(40);
    expect(total([20, 60])).toBe(80);
  });
});

describe("buildNodeRows", () => {
  const capacity = matrix(series({ node: "gpu-1" }, [[NOW, 2]]), series({ node: "gpu-2" }, [[NOW, 4]]));

  it("lists the nodes of the capacity series only, by name", () => {
    const rows = buildNodeRows(
      {
        capacity: matrix(series({ node: "gpu-b" }, [[NOW, 2]]), series({ node: "gpu-a" }, [[NOW, 2]])),
        utilization: matrix(series({ Hostname: "cpu-only" }, [[NOW, 90]])),
      },
      span,
    );

    expect(rows.map((row) => row.name)).toEqual(["gpu-a", "gpu-b"]);
  });

  it("joins the DCGM series by Hostname to the kube-state-metrics series by node", () => {
    const [row] = buildNodeRows(
      {
        capacity: matrix(series({ node: "gpu-1" }, [[NOW, 8]])),
        allocatable: matrix(series({ node: "gpu-1" }, [[NOW, 7]])),
        requests: matrix(series({ node: "gpu-1" }, [[NOW, 3]])),
        utilization: matrix(series({ Hostname: "gpu-1" }, [[NOW, 37.5]])),
        memoryUsed: matrix(series({ Hostname: "gpu-1" }, [[NOW, 10 * GiB]])),
        memoryTotal: matrix(series({ Hostname: "gpu-1" }, [[NOW, 80 * GiB]])),
      },
      span,
    );

    expect(row).toEqual({
      name: "gpu-1",
      gpus: 7,
      utilization: 37.5,
      memoryUsed: 10 * GiB,
      memoryTotal: 80 * GiB,
      requested: 3,
    });
  });

  it("averages the utilisation of several series for one node: the mean of 20 and 60 is 40", () => {
    const [row] = buildNodeRows(
      {
        capacity: matrix(series({ node: "gpu-1" }, [[NOW, 2]])),
        utilization: matrix(series({ Hostname: "gpu-1" }, [[NOW, 20]]), series({ Hostname: "gpu-1" }, [[NOW, 60]])),
        memoryUsed: matrix(series({ Hostname: "gpu-1" }, [[NOW, GiB]]), series({ Hostname: "gpu-1" }, [[NOW, GiB]])),
      },
      span,
    );

    expect(row.utilization).toBe(40);
    expect(row.memoryUsed).toBe(2 * GiB);
  });

  it("uses the newest sample of each series", () => {
    const [row] = buildNodeRows(
      {
        capacity,
        utilization: matrix(
          series({ Hostname: "gpu-1" }, [
            [NOW - 120, 10],
            [NOW - 60, 20],
            [NOW, 30],
          ]),
        ),
      },
      span,
    );

    expect(row.utilization).toBe(30);
  });

  it("gives a node DCGM has no series for no utilisation and no memory, never 0", () => {
    const rows = buildNodeRows(
      {
        capacity,
        utilization: matrix(series({ Hostname: "gpu-1" }, [[NOW, 0]])),
        memoryUsed: matrix(series({ Hostname: "gpu-1" }, [[NOW, 0]])),
        memoryTotal: matrix(series({ Hostname: "gpu-1" }, [[NOW, 80 * GiB]])),
      },
      span,
    );
    const [withData, withoutData] = rows;

    expect(withData.utilization).toBe(0);
    expect(withoutData.name).toBe("gpu-2");
    expect(withoutData.utilization).toBeUndefined();
    expect(withoutData.memoryUsed).toBeUndefined();
    expect(withoutData.memoryTotal).toBeUndefined();
  });

  it("falls back to the capacity without an allocatable series and to no requests", () => {
    const [row] = buildNodeRows({ capacity: matrix(series({ node: "gpu-1" }, [[NOW, 4]])) }, span);

    expect(row.gpus).toBe(4);
    expect(row.requested).toBe(0);
  });

  it("drops nodes whose series ended before the end of the span", () => {
    const rows = buildNodeRows(
      {
        capacity: matrix(series({ node: "old" }, [[NOW - 600, 2]]), series({ node: "live" }, [[NOW - 60, 2]])),
      },
      span,
    );

    expect(rows.map((row) => row.name)).toEqual(["live"]);
  });

  it("gives no rows for the failure shapes", () => {
    expect(buildNodeRows({}, span)).toEqual([]);
    expect(buildNodeRows({ capacity: {} as never }, span)).toEqual([]);
  });
});

describe("buildPodRows", () => {
  const pod = (name: string, namespace = "apps") => ({ pod: name, namespace });

  it("joins utilisation, device count and memory by namespace and pod", () => {
    const rows = buildPodRows(
      {
        utilization: matrix(series(pod("train-0"), [[NOW, 55]])),
        devices: matrix(series(pod("train-0"), [[NOW, 2]])),
        memoryUsed: matrix(series(pod("train-0"), [[NOW, 30 * GiB]])),
        memoryFree: matrix(series(pod("train-0"), [[NOW, 50 * GiB]])),
      },
      span,
    );

    expect(rows).toEqual([
      {
        namespace: "apps",
        name: "train-0",
        devices: 2,
        utilization: 55,
        memoryUsed: 30 * GiB,
        memoryTotal: 80 * GiB,
      },
    ]);
  });

  it("merges several series of one pod: the mean of 20 and 60 is 40, devices and memory add up", () => {
    const [row] = buildPodRows(
      {
        utilization: matrix(series(pod("train-0"), [[NOW, 20]]), series(pod("train-0"), [[NOW, 60]])),
        devices: matrix(series(pod("train-0"), [[NOW, 1]]), series(pod("train-0"), [[NOW, 1]])),
        memoryUsed: matrix(series(pod("train-0"), [[NOW, GiB]]), series(pod("train-0"), [[NOW, 2 * GiB]])),
        memoryFree: matrix(series(pod("train-0"), [[NOW, GiB]]), series(pod("train-0"), [[NOW, GiB]])),
      },
      span,
    );

    expect(row.utilization).toBe(40);
    expect(row.devices).toBe(2);
    expect(row.memoryUsed).toBe(3 * GiB);
    expect(row.memoryTotal).toBe(5 * GiB);
  });

  it("keeps pods of different namespaces apart", () => {
    const rows = buildPodRows(
      { utilization: matrix(series(pod("p", "a"), [[NOW, 1]]), series(pod("p", "b"), [[NOW, 2]])) },
      span,
    );

    expect(rows.map((row) => `${row.namespace}/${row.name}`)).toEqual(["b/p", "a/p"]);
  });

  it("sorts by utilisation, busiest first, with pods without a utilisation last", () => {
    const rows = buildPodRows(
      {
        utilization: matrix(series(pod("idle"), [[NOW, 0]]), series(pod("busy"), [[NOW, 90]])),
        devices: matrix(series(pod("no-util"), [[NOW, 1]])),
      },
      span,
    );

    expect(rows.map((row) => row.name)).toEqual(["busy", "idle", "no-util"]);
    expect(rows[2].utilization).toBeUndefined();
  });

  it("gives no memory total unless both the used and the free memory are known", () => {
    const [row] = buildPodRows({ memoryUsed: matrix(series(pod("p"), [[NOW, GiB]])) }, span);

    expect(row.memoryUsed).toBe(GiB);
    expect(row.memoryTotal).toBeUndefined();
  });

  it("drops pods that are gone and series without a pod or a namespace", () => {
    const rows = buildPodRows(
      {
        utilization: matrix(
          series(pod("gone"), [[NOW - 900, 50]]),
          series({ pod: "no-namespace" }, [[NOW, 50]]),
          series({ namespace: "apps" }, [[NOW, 50]]),
          series(pod("here"), [[NOW, 50]]),
        ),
      },
      span,
    );

    expect(rows.map((row) => row.name)).toEqual(["here"]);
  });

  it("gives no rows for the failure shapes", () => {
    expect(buildPodRows({}, span)).toEqual([]);
    expect(buildPodRows({ utilization: {} as never }, span)).toEqual([]);
  });
});
