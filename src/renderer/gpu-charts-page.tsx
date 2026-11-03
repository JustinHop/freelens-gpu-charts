/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import React from "react";
import { buildNodeRows, buildPodRows } from "./aggregate";
import { ClusterCharts } from "./cluster-charts";
import { type MetricData, pickGroup } from "./metrics";
import { NodesTable } from "./nodes-table";
import { type ClusterMetricName, type NodeTableMetricName, type PodTableMetricName, pageQueries } from "./promql";
import { RangeSelector } from "./range-selector";
import { ensureStyles } from "./styles";
import { pageRanges, type RangeKey } from "./time-range";
import { usePolledMetrics } from "./use-polled-metrics";
import { WorkloadsTable } from "./workloads-table";

const { Spinner, TabLayout } = Renderer.Component;

/** The "GPU Charts" cluster page: cluster history charts, then a table per node and per pod. */
export function GpuChartsPage() {
  ensureStyles();

  const [range, setRange] = React.useState<RangeKey>("1h");
  const queries = React.useMemo(pageQueries, []);
  const { status, metrics, span } = usePolledMetrics(queries, range);
  const loaded = span !== undefined;

  const cluster = React.useMemo(() => pickGroup<ClusterMetricName>(metrics, "cluster"), [metrics]);
  const nodeRows = React.useMemo(
    () => (span ? buildNodeRows(pickGroup<NodeTableMetricName>(metrics, "node"), span) : []),
    [metrics, span],
  );
  const podRows = React.useMemo(
    () => (span ? buildPodRows(pickGroup<PodTableMetricName>(metrics, "pod"), span) : []),
    [metrics, span],
  );

  return (
    <TabLayout scrollable>
      <div className="GpuChartsPage">
        <div className="GpuChartsHeader">
          <h2>GPU Charts</h2>
          <div className="GpuChartsHeaderControls">
            {loaded && status === "loading" && <Spinner />}
            <RangeSelector ranges={pageRanges} value={range} onChange={setRange} />
          </div>
        </div>
        {status === "failed" && (
          <div className="GpuChartsError">
            Could not load GPU metrics. Check that Prometheus is configured for this cluster in its settings.
          </div>
        )}
        {!loaded && status === "loading" && <Spinner center />}
        {loaded && (
          <>
            <ClusterCharts metrics={cluster as Partial<Record<ClusterMetricName, MetricData>>} span={span} />
            <section className="GpuChartsSection">
              <h3 className="GpuChartsSectionTitle">Nodes</h3>
              <NodesTable rows={nodeRows} />
            </section>
            <section className="GpuChartsSection">
              <h3 className="GpuChartsSectionTitle">Workloads</h3>
              <WorkloadsTable rows={podRows} />
            </section>
          </>
        )}
      </div>
    </TabLayout>
  );
}
