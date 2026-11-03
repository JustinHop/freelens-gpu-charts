/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

// Loads the built bundle the way Freelens does: as a CommonJS module that finds the host's
// libraries as globals. Run it after `pnpm build:bundle`; `pnpm build` does.

import { existsSync, readFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { resolve } from "node:path";
import * as Mobx from "mobx";
import * as MobxReact from "mobx-react";
import React from "react";
import * as ReactJsxRuntime from "react/jsx-runtime";
import ReactDOM from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const bundlePath = resolve(__dirname, "../../../out/renderer/index.js");

class LensRendererExtensionStub {
  clusterPages: unknown[] = [];
  clusterPageMenus: unknown[] = [];
  kubeObjectDetailItems: unknown[] = [];
  constructor(readonly manifest: unknown) {}
}

/** A component that renders its children, so that what the extension builds shows in the markup. */
const passThrough =
  (name: string) =>
  ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-stub": name }, children);

const ResourceMetricsContext = React.createContext<unknown>(null);

interface RequestParams {
  start: number;
  end: number;
  step: number;
  namespace?: string;
}

/** What Prometheus would answer for one query, in the shape the host's route returns it. */
function answer(query: string, { end }: RequestParams) {
  const point = (value: number): [number, string] => [end, String(value)];
  const matrix = (...result: { metric: Record<string, string>; values: [number, string][] }[]) => ({
    status: "success",
    data: { resultType: "matrix", result },
  });

  if (query.startsWith("avg(DCGM_FI_DEV_GPU_UTIL) by (Hostname)")) {
    return matrix(
      { metric: { Hostname: "gpu-1" }, values: [point(20)] },
      { metric: { Hostname: "gpu-1" }, values: [point(60)] },
    );
  }
  if (query.includes("by (Hostname)")) return matrix({ metric: { Hostname: "gpu-1" }, values: [point(8 * 1024 ** 3)] });
  if (query.startsWith("sum(kube_node_status_capacity") && query.includes("by (node)")) {
    return matrix({ metric: { node: "gpu-1" }, values: [point(2)] }, { metric: { node: "gpu-2" }, values: [point(4)] });
  }
  if (query.includes("by (node)")) return matrix({ metric: { node: "gpu-1" }, values: [point(1)] });
  if (query.startsWith("avg(DCGM_FI_DEV_GPU_UTIL{pod=")) {
    return matrix({ metric: { namespace: "apps", pod: "train-0" }, values: [point(55)] });
  }
  if (query.includes("by (namespace, pod)")) {
    return matrix({ metric: { namespace: "apps", pod: "train-0" }, values: [point(2)] });
  }

  return matrix({ metric: {}, values: [point(1)] });
}

const requestMetrics = vi.fn(async (queries: string[], params: RequestParams) =>
  queries.map((query) => answer(query, params)),
);
const stopPolling = vi.fn();
const interval = vi.fn((_seconds: number, callback: () => void) => ({
  start: (runImmediately?: boolean) => {
    if (runImmediately) callback();
  },
  stop: stopPolling,
}));

const hostGlobals = {
  Common: {
    Util: { interval, bytesToUnits: (bytes: number) => `${bytes}B` },
  },
  Renderer: {
    LensExtension: LensRendererExtensionStub,
    Component: {
      BarChart: ({ data }: { data: { datasets: { label: string; data: unknown[] }[] } }) =>
        React.createElement(
          "div",
          { "data-stub": "BarChart" },
          data.datasets.map((dataset) => `${dataset.label}:${dataset.data.length}`).join(","),
        ),
      DrawerTitle: passThrough("DrawerTitle"),
      Icon: passThrough("Icon"),
      LineProgress: ({ tooltip }: { tooltip?: string }) => React.createElement("i", { "data-tooltip": tooltip }),
      Radio: passThrough("Radio"),
      RadioGroup: passThrough("RadioGroup"),
      ResourceMetrics: ({
        object,
        tabs,
        metrics,
        children,
      }: {
        object: unknown;
        tabs: string[];
        metrics: unknown;
        children?: React.ReactNode;
      }) =>
        React.createElement(
          ResourceMetricsContext.Provider,
          { value: { object, tab: tabs[0], metrics, isPending: false } },
          children,
        ),
      ResourceMetricsContext,
      Spinner: passThrough("Spinner"),
      TabLayout: passThrough("TabLayout"),
      Table: ({
        items = [],
        renderRow,
        children,
      }: {
        items?: unknown[];
        renderRow: (item: unknown) => React.ReactNode;
        children?: React.ReactNode;
      }) => React.createElement("div", { "data-stub": "Table" }, children, items.map(renderRow)),
      TableCell: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children, "|"),
      TableHead: passThrough("TableHead"),
      TableRow: passThrough("TableRow"),
      memoryOptions: { scales: { yAxes: [{ ticks: {} }] }, tooltips: {} },
    },
    K8sApi: {
      requestMetrics,
      podsStore: { subscribe: vi.fn(() => () => {}), getPodsByOwnerId: () => [] },
      deploymentStore: { getChildPods: () => [] },
    },
    Navigation: { showDetails: vi.fn() },
    Theme: { activeTheme: { get: () => ({ colors: { chartCapacityColor: "#4c545f" } }) } },
  },
};

const hostLibraries = { React, ReactDOM, ReactJsxRuntime, Mobx, MobxReact, ReactRouter: {}, ReactRouterDom: {} };

const globals = globalThis as unknown as Record<string, unknown>;
const installed = [...Object.keys(hostLibraries), "LensExtensions"];

const gpuNode = {
  getId: () => "node-id",
  getName: () => "gpu-1",
  getNs: () => undefined,
  status: { capacity: { "nvidia.com/gpu": "8" } },
};
const cpuNode = { ...gpuNode, status: { capacity: { cpu: "8" } } };

describe("the built renderer bundle", () => {
  let Extension: any;
  const source = existsSync(bundlePath) ? readFileSync(bundlePath, "utf8") : "";

  beforeAll(() => {
    if (!existsSync(bundlePath)) throw new Error(`${bundlePath} is missing: run "pnpm build:bundle" first`);

    Object.assign(globals, hostLibraries, { LensExtensions: hostGlobals });
    Extension = createRequire(import.meta.url)(bundlePath).default;
  });

  afterAll(() => {
    for (const name of installed) delete globals[name];
  });

  it("default-exports an extension class built on the host's renderer extension", () => {
    expect(typeof Extension).toBe("function");
    expect(new Extension({})).toBeInstanceOf(LensRendererExtensionStub);
  });

  it("registers one cluster page with its sidebar entry", () => {
    const extension = new Extension({});

    expect(extension.clusterPages).toHaveLength(1);
    expect(extension.clusterPages[0].id).toBe("gpu-charts");
    expect(typeof extension.clusterPages[0].components.Page).toBe("function");
    expect(extension.clusterPageMenus).toHaveLength(1);
    expect(extension.clusterPageMenus[0]).toMatchObject({ target: { pageId: "gpu-charts" }, title: "GPU Charts" });
    expect(typeof extension.clusterPageMenus[0].components.Icon).toBe("function");
  });

  it("registers the six detail items under the built-in metrics block", () => {
    const items = new Extension({}).kubeObjectDetailItems as {
      kind: string;
      apiVersions: string[];
      priority: number;
      components: { Details: unknown };
    }[];

    expect(items.map((item) => [item.kind, item.apiVersions])).toEqual([
      ["Node", ["v1"]],
      ["Pod", ["v1"]],
      ["Deployment", ["apps/v1"]],
      ["StatefulSet", ["apps/v1"]],
      ["DaemonSet", ["apps/v1"]],
      ["Job", ["batch/v1"]],
    ]);
    for (const item of items) {
      expect(item.priority).toBe(300.5);
      // A function, or the object React.memo makes of one: `observer` wraps its components in it.
      expect(["function", "object"]).toContain(typeof item.components.Details);
      expect(item.components.Details).not.toBeNull();
    }
  });

  it("renders the page into its loading state and adds the stylesheet", () => {
    const { Page } = new Extension({}).clusterPages[0].components;
    const markup = renderToStaticMarkup(React.createElement(Page));

    expect(markup).toContain("GpuChartsPage");
    expect(markup).toContain("GPU Charts");
    expect(markup).toContain('data-stub="Spinner"');
    expect(document.getElementById("freelens-gpu-charts-styles")?.textContent).toContain(".GpuChartsPage");
  });

  it("renders a GPU block for a node with GPUs and nothing for a node without", () => {
    const [{ components }] = new Extension({}).kubeObjectDetailItems;

    const withGpu = renderToStaticMarkup(React.createElement(components.Details, { object: gpuNode }));
    const without = renderToStaticMarkup(React.createElement(components.Details, { object: cpuNode }));

    expect(withGpu).toContain("GpuChartsDetails");
    expect(withGpu).toContain('data-stub="DrawerTitle"');
    expect(without).toBe("");
  });

  describe("mounted in a document", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      requestMetrics.mockClear();
      stopPolling.mockClear();
      interval.mockClear();
    });

    // React 17 runs the cleanup of effects after an unmount asynchronously; `act` flushes it.
    const unmount = () =>
      act(() => {
        ReactDOM.unmountComponentAtNode(container);
      });

    afterEach(() => {
      unmount();
      container.remove();
    });

    const mount = async (element: React.ReactElement) => {
      await act(async () => {
        ReactDOM.render(element, container);
      });
      await act(async () => {});
    };

    it("loads the page's metrics as one batch and fills the charts and both tables", async () => {
      const { Page } = new Extension({}).clusterPages[0].components;

      await mount(React.createElement(Page));

      expect(requestMetrics).toHaveBeenCalledTimes(1);
      const [queries, params] = requestMetrics.mock.calls[0];

      expect(queries).toHaveLength(16);
      expect(queries).toContain("sum(DCGM_FI_DEV_GPU_UTIL) / 100");
      expect(params).toMatchObject({ step: 60 });
      expect(params.end - params.start).toBe(3600);
      expect(interval).toHaveBeenCalledWith(60, expect.any(Function));

      const text = container.textContent ?? "";
      const tooltips = [...container.querySelectorAll("[data-tooltip]")].map((el) => el.getAttribute("data-tooltip"));

      expect(container.querySelectorAll('[data-stub="BarChart"]')).toHaveLength(2);
      expect(container.querySelector('[data-stub="BarChart"]')?.textContent).toBe("GPU usage:1");
      // gpu-1: the mean of 20 and 60; gpu-2 has capacity but no DCGM series.
      expect(text).toContain("gpu-1");
      expect(tooltips).toContain("GPU: 40%");
      expect(text).toMatch(/gpu-2\|4\|N\/A\|N\/A\|0\|/);
      expect(text).toContain("train-0");
      expect(tooltips).toContain("GPU: 55%");
      expect(text).not.toContain("No GPU metrics");
    });

    it("stops polling when the page unmounts", async () => {
      const { Page } = new Extension({}).clusterPages[0].components;

      await mount(React.createElement(Page));
      expect(stopPolling).not.toHaveBeenCalled();
      unmount();
      expect(stopPolling).toHaveBeenCalledTimes(1);
    });

    it("says there are no GPU metrics when the host answers with the failure object", async () => {
      requestMetrics.mockResolvedValueOnce({} as never);
      const { Page } = new Extension({}).clusterPages[0].components;

      await mount(React.createElement(Page));

      expect(container.textContent).toContain("Could not load GPU metrics");
      expect(container.querySelector('[data-stub="BarChart"]')).toBeNull();
    });

    it("draws a node's usage, requests and capacities in its GPU block", async () => {
      const [{ components }] = new Extension({}).kubeObjectDetailItems;

      await mount(React.createElement(components.Details, { object: gpuNode }));

      expect(requestMetrics).toHaveBeenCalledTimes(1);
      const [queries, params] = requestMetrics.mock.calls[0];

      expect(queries[0]).toBe('sum(DCGM_FI_DEV_GPU_UTIL{Hostname="gpu-1"}) / 100');
      expect(params.namespace).toBeUndefined();
      expect(container.querySelector('[data-stub="BarChart"]')?.textContent).toBe(
        "Usage:1,Requests:1,Allocatable Capacity:1,Capacity:1",
      );
    });

    it("draws a pod's usage, requests and limits in its GPU block, scoped to its namespace", async () => {
      const [, { components }] = new Extension({}).kubeObjectDetailItems;
      const pod = {
        getId: () => "pod-id",
        getName: () => "train-0",
        getNs: () => "apps",
        spec: { containers: [{ resources: { limits: { "nvidia.com/gpu": "1" } } }] },
      };

      await mount(React.createElement(components.Details, { object: pod }));

      expect(requestMetrics.mock.calls[0][1].namespace).toBe("apps");
      expect(container.querySelector('[data-stub="BarChart"]')?.textContent).toBe("Usage:1,Requests:1,Limits:1");
    });
  });

  it("takes the host's libraries from globals instead of bundling them", () => {
    const requires = [...source.matchAll(/\brequire\((["'])([^"']+)\1\)/g)].map((match) => match[2]);
    const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

    expect(requires.filter((id) => !builtins.has(id))).toEqual([]);
    for (const global of ["LensExtensions", "React", "ReactJsxRuntime", "MobxReact"]) {
      expect(source).toContain(`global.${global}`);
    }
    // React's own source would be in the bundle if react had been bundled.
    expect(source).not.toContain("__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =");
    expect(source.length).toBeLessThan(500_000);
  });
});
