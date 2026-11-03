/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";
import { nodeLink, openDetails } from "./links";
import { NoGpuMetrics } from "./no-gpu-metrics";
import { MemoryBar, UtilizationBar } from "./table-cells";

import type { NodeRow } from "./aggregate";

const { Table, TableCell, TableHead, TableRow } = Renderer.Component;

/** The row as the host's Table wants its items. */
interface NodeItem extends NodeRow {
  getId(): string;
  getName(): string;
}

const asItem = (row: NodeRow): NodeItem => ({ ...row, getId: () => row.name, getName: () => row.name });

const memoryShare = (row: NodeRow) => (row.memoryTotal ? (row.memoryUsed ?? 0) / row.memoryTotal : -1);

/** The sort keys of the columns; a node without DCGM data sorts below every node with some. */
export const nodeSortable = {
  name: (row: NodeRow) => row.name,
  gpus: (row: NodeRow) => row.gpus,
  gpu: (row: NodeRow) => row.utilization ?? -1,
  memory: (row: NodeRow) => (row.memoryUsed === undefined ? -1 : memoryShare(row)),
  requested: (row: NodeRow) => row.requested,
};

export function NodesTable({ rows }: { rows: NodeRow[] }) {
  return (
    <Table
      tableId="gpu-charts-nodes"
      className="GpuChartsTable"
      items={rows.map(asItem)}
      sortable={nodeSortable}
      sortByDefault={{ sortBy: "name", orderBy: "asc" }}
      sortSyncWithUrl={false}
      noItems={<NoGpuMetrics message="No nodes with GPUs" />}
      renderRow={(item: NodeItem) => (
        <TableRow key={item.name} sortItem={item} nowrap>
          <TableCell className="name">
            <button type="button" className="GpuChartsLink" onClick={() => openDetails(nodeLink(item.name))}>
              {item.name}
            </button>
          </TableCell>
          <TableCell className="narrow">{item.gpus}</TableCell>
          <TableCell className="bar">
            <UtilizationBar utilization={item.utilization} />
          </TableCell>
          <TableCell className="bar">
            <MemoryBar used={item.memoryUsed} total={item.memoryTotal} />
          </TableCell>
          <TableCell className="narrow">{item.requested}</TableCell>
        </TableRow>
      )}
    >
      <TableHead nowrap>
        <TableCell className="name" sortBy="name">
          Node
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
        <TableCell className="narrow" sortBy="requested">
          Requested
        </TableCell>
      </TableHead>
    </Table>
  );
}
