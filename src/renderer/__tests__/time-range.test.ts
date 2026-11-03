/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { describe, expect, it } from "vitest";
import { detailRanges, pageRanges, rangeWindow, stepFor } from "../time-range";

describe("rangeWindow", () => {
  it("reaches back from now over the range", () => {
    expect(rangeWindow("1h", 10_000)).toEqual({ start: 6_400, end: 10_000, step: 60 });
    expect(rangeWindow("7d", 1_000_000)).toEqual({ start: 1_000_000 - 604_800, end: 1_000_000, step: 3600 });
  });

  it("rounds now down to whole seconds", () => {
    expect(rangeWindow("1h", 10_000.9).end).toBe(10_000);
  });
});

describe("stepFor", () => {
  it.each([
    ["1h", 3600, 60],
    ["4h", 4 * 3600, 60],
    ["6h", 6 * 3600, 600],
    ["24h", 24 * 3600, 600],
    ["7d", 7 * 24 * 3600, 3600],
  ])("uses %s -> %ds", (_label, seconds, step) => {
    expect(stepFor(seconds)).toBe(step);
  });
});

describe("ranges", () => {
  it("offer 1h, 6h, 24h and 7d on the page and without 7d in details", () => {
    expect(pageRanges).toEqual(["1h", "6h", "24h", "7d"]);
    expect(detailRanges).toEqual(["1h", "6h", "24h"]);
  });
});
