import { renderInstancePreview } from "@/lib/widgets";
import "./widget-preview.css";

const previewPolicy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";

export function WidgetPreview({ instanceId }: { instanceId: string }) {
  const preview = renderInstancePreview(instanceId);
  if (!preview) {
    return <p className="widget-preview-message">This template is unavailable for preview.</p>;
  }

  const markup = preview.html.replace(/^\s*<!doctype\s+html\s*>/i, "");
  const scriptPolicy = preview.scriptHashes.join(" ") || "'none'";
  const srcDoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${previewPolicy}; script-src ${scriptPolicy}">${markup}`;

  return (
    <div className="widget-preview">
      <iframe
        title="Widget preview"
        className="widget-preview-frame"
        style={{ height: preview.embedHeight }}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
      <p>Preview uses the saved settings. Test an embed link to verify its approved origins.</p>
    </div>
  );
}
