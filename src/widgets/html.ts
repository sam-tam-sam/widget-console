import { createHash } from "node:crypto";
import type { WidgetInstance, WidgetTemplate } from "./contracts";
import { hostFrameScript, type WidgetHostFrame } from "./host-frame";

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

/** CSS and body are template-owned markup. Escape dynamic text before inserting it. */
export function widgetDocument(title: string, css: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css}
    html, body { margin: 0; background: transparent; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function appendWidgetScript(html: string, source: string, attributes = "") {
  // Hash the exact reviewed script that the HTML parser receives.
  const script = source.replace(/\r\n?/g, "\n");
  const end = html.lastIndexOf("</body>");
  if (end < 0 || /<\/script/i.test(script)) {
    throw new Error("Invalid widget script or document body.");
  }
  const hash = createHash("sha256").update(script).digest("base64");
  return {
    html: `${html.slice(0, end)}<script${attributes}>${script}</script>${html.slice(end)}`,
    hash: `'sha256-${hash}'`,
  };
}

export function renderWidgetDocument(template: WidgetTemplate, instance: WidgetInstance, frame?: WidgetHostFrame) {
  let html = template.render(instance);
  const scriptHashes: string[] = [];
  if (template.clientScript) {
    const script = appendWidgetScript(html, template.clientScript);
    html = script.html;
    scriptHashes.push(script.hash);
  }
  if (frame && template.hostEmbed) {
    const attributes = ` data-parent-origin="${escapeHtml(frame.parentOrigin)}" data-channel="${escapeHtml(frame.channel)}"`;
    const script = appendWidgetScript(html, hostFrameScript, attributes);
    html = script.html;
    scriptHashes.push(script.hash);
  }
  return { html, scriptHashes };
}
