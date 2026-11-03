/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { Renderer } from "@freelensapp/extensions";

import type { RangeKey } from "./time-range";

const { Radio, RadioGroup } = Renderer.Component;

export interface RangeSelectorProps {
  ranges: readonly RangeKey[];
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}

/** The time range of every chart in a view; separate from the one of the built-in charts. */
export function RangeSelector({ ranges, value, onChange }: RangeSelectorProps) {
  return (
    <div className="GpuChartsRange">
      <span>Time range</span>
      <RadioGroup<RangeKey> asButtons value={value} onChange={onChange}>
        {ranges.map((range) => (
          <Radio<RangeKey> key={range} label={range} value={range} />
        ))}
      </RadioGroup>
    </div>
  );
}
