/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { formatPercent } from "./chart-data";
import { formatBytes } from "./format";

const { LineProgress } = Renderer.Component;

/** Shown for a value DCGM did not report; never a zero. */
export function NotAvailable() {
  return <span className="GpuChartsNotAvailable">N/A</span>;
}

/** Mean GPU utilisation in percent as a bar with its number under it. */
export function UtilizationBar({ utilization }: { utilization: number | undefined }) {
  if (utilization === undefined) return <NotAvailable />;

  const text = formatPercent(utilization);

  return (
    <div className="GpuChartsBar usage">
      <LineProgress max={100} value={utilization} tooltip={`GPU: ${text}`} />
      <span className="GpuChartsBarText">{text}</span>
    </div>
  );
}

/** VRAM in use out of the total as a bar with the two sizes under it. */
export function MemoryBar({ used, total }: { used: number | undefined; total: number | undefined }) {
  if (used === undefined || !total) return <NotAvailable />;

  const text = `${formatBytes(used)} / ${formatBytes(total)}`;

  return (
    <div className="GpuChartsBar memory">
      <LineProgress max={total} value={used} tooltip={`GPU Memory: ${text} (${formatPercent((used * 100) / total)})`} />
      <span className="GpuChartsBarText">{text}</span>
    </div>
  );
}
