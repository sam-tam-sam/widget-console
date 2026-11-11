import { randomUUID } from "node:crypto";
import { applicationOrigin } from "@/lib/embeds";
import { renderInstancePreview } from "@/lib/widgets";
import { WidgetHostPreview } from "./widget-host-preview";
import { WidgetPreviewFrame } from "./widget-preview-frame";
import "./widget-preview.css";

export function WidgetPreview({ instanceId }: { instanceId: string }) {
  const parentOrigin = applicationOrigin()?.origin;
  const channel = randomUUID();
  const preview = renderInstancePreview(instanceId, parentOrigin ? { parentOrigin, channel } : undefined);
  if (!preview) {
    return <p className="widget-preview-message">This template is unavailable for preview.</p>;
  }

  const markup = preview.html.replace(/^\s*<!doctype\s+html\s*>/i, "");
  const scriptPolicy = preview.scriptHashes.join(" ") || "'none'";
  const imagePolicy = preview.hostEmbed && parentOrigin ? `data: ${parentOrigin}` : "data:";
  const previewPolicy = `default-src 'none'; style-src 'unsafe-inline'; img-src ${imagePolicy}; font-src data:; base-uri 'none'; form-action 'none'`;
  const srcDoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${previewPolicy}; script-src ${scriptPolicy}">${markup}`;

  if (preview.hostEmbed) {
    // The authenticated server request supplies one timestamp to both renders of the preview.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return <WidgetHostPreview key={channel} srcDoc={srcDoc} configuration={preview.hostEmbed} channel={channel} now={now} />;
  }
  return <WidgetPreviewFrame srcDoc={srcDoc} heights={preview.embedHeights} />;
}
