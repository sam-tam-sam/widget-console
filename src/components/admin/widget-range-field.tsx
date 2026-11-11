"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

export function WidgetRangeField({ defaultValue, ...input }: ComponentProps<typeof Input> & { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="console-range-control">
      <Input {...input} type="range" value={value} onChange={(event) => setValue(event.currentTarget.value)} />
      <span aria-hidden="true">{value}%</span>
    </div>
  );
}
