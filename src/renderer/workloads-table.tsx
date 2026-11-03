/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { openDetails, podLink } from "./links";
import { NoGpuMetrics } from "./no-gpu-metrics";
import { MemoryBar, UtilizationBar } from "./table-cells";

import type { PodRow } from "./aggregate";

const { Table, TableCell, TableHead, TableRow } = Renderer.Component;

/** The row as the host's Table wants its items. */
interface PodItem extends PodRow {
  getId(): string;
  getName(): string;
}

const asItem = (row: PodRow): PodItem => ({
  ...row,
  getId: () => `${row.namespace}/${row.name}`,
  getName: () => row.name,
});

/** The sort keys of the columns; a pod without a value sorts below every pod with one. */
export const podSortable = {
  namespace: (row: PodRow) => row.namespace,
  pod: (row: PodRow) => row.name,
  gpus: (row: PodRow) => row.devices ?? -1,
  gpu: (row: PodRow) => row.utilization ?? -1,
  memory: (row: PodRow) => (row.memoryUsed !== undefined && row.memoryTotal ? row.memoryUsed / row.memoryTotal : -1),
};

export function WorkloadsTable({ rows }: { rows: PodRow[] }) {
  return (
    <Table
      tableId="gpu-charts-workloads"
      className="GpuChartsTable"
      items={rows.map(asItem)}
      sortable={podSortable}
      sortByDefault={{ sortBy: "gpu", orderBy: "desc" }}
      sortSyncWithUrl={false}
      noItems={<NoGpuMetrics message="No pods are using GPUs" />}
      renderRow={(item: PodItem) => (
        <TableRow key={item.getId()} sortItem={item} nowrap>
          <TableCell className="name">{item.namespace}</TableCell>
          <TableCell className="name">
            <button
              type="button"
              className="GpuChartsLink"
              onClick={() => openDetails(podLink(item.namespace, item.name))}
            >
              {item.name}
            </button>
          </TableCell>
          <TableCell className="narrow">{item.devices ?? "-"}</TableCell>
          <TableCell className="bar">
            <UtilizationBar utilization={item.utilization} />
          </TableCell>
          <TableCell className="bar">
            <MemoryBar used={item.memoryUsed} total={item.memoryTotal} />
          </TableCell>
        </TableRow>
      )}
    >
      <TableHead nowrap>
        <TableCell className="name" sortBy="namespace">
          Namespace
        </TableCell>
        <TableCell className="name" sortBy="pod">
          Pod
        </TableCell>
        <TableCell className="narrow" sortBy="gpus">
          GPUs
        </TableCell>
        <TableCell className="bar" sortBy="gpu">
          GPU
        </TableCell>
        <TableCell className="bar" sortBy="memory">
          GPU Memory
        </TableCell>
      </TableHead>
    </Table>
  );
}
