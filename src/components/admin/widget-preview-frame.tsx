"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetEmbedHeights } from "@/widgets/contracts";
import { widgetEmbedProfiles } from "@/widgets/embed-size";

export function WidgetPreviewFrame({ srcDoc, heights }: { srcDoc: string; heights: WidgetEmbedHeights }) {
  const [profile, setProfile] = useState<(typeof widgetEmbedProfiles)[number]>(widgetEmbedProfiles[2]);

  return (
    <div className="widget-preview">
      <div className="widget-preview-toolbar">
        <span>Preview width</span>
        <div className="widget-preview-widths" role="group" aria-label="Preview width">
          {widgetEmbedProfiles.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={option.key === profile.key ? "default" : "outline"}
              aria-pressed={option.key === profile.key}
              onClick={() => setProfile(option)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
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
