import { createHash } from "node:crypto";
import type { WidgetInstance, WidgetTemplate } from "./contracts";

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
  <style>${css}</style>
</head>
<body>${body}</body>
</html>`;
}

export function renderWidgetDocument(template: WidgetTemplate, instance: WidgetInstance) {
  const html = template.render(instance);
  if (!template.clientScript) return { html, scriptHashes: [] };

  // Hash the exact reviewed script that the HTML parser receives.
  const script = template.clientScript.replace(/\r\n?/g, "\n");
  const end = html.lastIndexOf("</body>");
  if (end < 0 || /<\/script/i.test(script)) {
    throw new Error("Invalid widget script or document body.");
  }
  const hash = createHash("sha256").update(script).digest("base64");
  return {
    html: `${html.slice(0, end)}<script>${script}</script>${html.slice(end)}`,
    scriptHashes: [`'sha256-${hash}'`],
  };
}
