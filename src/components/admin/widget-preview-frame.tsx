"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetEmbedHeights } from "@/widgets/contracts";
import { widgetEmbedProfiles } from "@/widgets/embed-size";

export function WidgetPreviewWidths<Key extends string>({ profiles, selected, select }: {
  profiles: readonly { key: Key; label: string }[];
  selected: Key;
  select: (key: Key) => void;
}) {
  return (
    <div className="widget-preview-toolbar">
      <span>Preview width</span>
      <div className="widget-preview-widths" role="group" aria-label="Preview width">
        {profiles.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant={option.key === selected ? "default" : "outline"}
            aria-pressed={option.key === selected}
            onClick={() => select(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function WidgetPreviewFrame({ srcDoc, heights }: { srcDoc: string; heights: WidgetEmbedHeights }) {
  const [selected, select] = useState<(typeof widgetEmbedProfiles)[number]["key"]>("wide");
  const profile = widgetEmbedProfiles.find(({ key }) => key === selected) ?? widgetEmbedProfiles[2];

  return (
    <div className="widget-preview">
      <WidgetPreviewWidths profiles={widgetEmbedProfiles} selected={selected} select={select} />
      <iframe
        title="Widget preview"
        className="widget-preview-frame"
        style={{ width: profile.previewWidth ?? "100%", height: heights[profile.key] }}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
      <p>Preview uses saved settings and fits the available space. Test the embed on an approved site before publishing.</p>
    </div>
  );
}
