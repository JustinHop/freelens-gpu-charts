/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Common, Renderer } from "@freelensapp/extensions";
import React from "react";
import { type MetricData, requestNamed } from "./metrics";
import { type RangeKey, type RangeWindow, rangeWindow } from "./time-range";

/** How often the views reload while they are mounted. */
export const POLL_SECONDS = 60;

export interface PolledMetrics<Keys extends string> {
  /** `loading` until the first answer of a new query or range; `failed` keeps the last answer, if any. */
  status: "loading" | "ready" | "failed";
  metrics: Partial<Record<Keys, MetricData>>;
  /** The time span the metrics were loaded for; undefined until the first load finishes. */
  span?: RangeWindow;
}

interface State<Keys extends string> extends PolledMetrics<Keys> {
  /** The queries the state belongs to. */
  key: string;
}

/**
 * Runs the queries over the range now and then every minute while the calling component is
 * mounted. A change of the range keeps showing the previous answer until the new one arrives;
 * a change of the queries, which means another object, starts over empty.
 */
export function usePolledMetrics<Keys extends string>(
  queries: Partial<Record<Keys, string>>,
  range: RangeKey,
  namespace?: string,
): PolledMetrics<Keys> {
  const key = JSON.stringify(queries);
  const [state, setState] = React.useState<State<Keys>>({ key, status: "loading", metrics: {} });

  React.useEffect(() => {
    let cancelled = false;

    setState((previous) =>
      previous.key === key ? { ...previous, status: "loading" } : { key, status: "loading", metrics: {} },
    );

    const load = async () => {
      const span = rangeWindow(range, Date.now() / 1000);
      const result = await requestNamed<Keys>(
        (batch, params) => Renderer.K8sApi.requestMetrics(batch, params),
        queries,
        { ...span, namespace },
      );

      if (cancelled) return;

      setState((previous) =>
        result.ok ? { key, status: "ready", metrics: result.metrics, span } : { ...previous, key, status: "failed" },
      );
    };

    const timer = Common.Util.interval(POLL_SECONDS, () => void load());

    timer.start(true);

    return () => {
      cancelled = true;
      timer.stop();
    };
  }, [key, range, namespace]);

  // Between a change of the queries and the effect that resets the state, nothing of the old object shows.
  return state.key === key
    ? { status: state.status, metrics: state.metrics, span: state.span }
    : { status: "loading", metrics: {} };
}
