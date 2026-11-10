import { CodeXml, Link2, Plus } from "lucide-react";
import { createLinkAction, toggleLinkAction, updateOriginsAction } from "@/app/(admin)/admin/actions";
import { EmbedCode } from "@/components/admin/embed-code";
import { AdminForm } from "@/components/admin/form";
import { Label } from "@/components/ui/label";
import { configuredOrigin } from "@/lib/embeds";
import type { WidgetLink } from "@/lib/widgets";
import type { WidgetInstance } from "@/widgets/contracts";

function OriginsField({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <div className="console-field">
      <Label htmlFor={id}>Approved origins</Label>
      <textarea key={defaultValue} id={id} name="origins" className="console-code-field"
        defaultValue={defaultValue} rows={3} maxLength={8192} required spellCheck={false}
        placeholder="https://example.com" aria-describedby={`${id}-help`} />
      <small id={`${id}-help`}>Enter one HTTPS origin per line, including its port if present.</small>
    </div>
  );
}

function escapeAttribute(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function makeEmbedMarkup(origin: string, id: string, title: string, height: number) {
  const src = new URL(`/embed/${encodeURIComponent(id)}`, origin).href;
  return `<iframe src="${escapeAttribute(src)}" title="${escapeAttribute(title)}" width="100%" height="${height}" loading="lazy"></iframe>`;
}

function LinkCard({ link, origin, embedTitle, height }: { link: WidgetLink; origin: string | null; embedTitle: string; height: number }) {
  return (
    <li data-link-id={link.id} className="console-link-record">
      <div className="console-link-heading">
        <span className="console-instance-icon"><Link2 size={17} aria-hidden="true" /></span>
        <div className="console-record-name">
          <h3>{link.origins[0] ?? "Embed link"}</h3>
          <small>{link.origins.length} approved {link.origins.length === 1 ? "origin" : "origins"}</small>
        </div>
        <span className="console-badge" aria-live="polite" data-enabled={link.enabled}>
          <span aria-hidden="true" />{link.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      {origin ? (
        <EmbedCode markup={makeEmbedMarkup(origin, link.id, embedTitle, height)} />
      ) : (
        <p className="console-empty-note">Configure the public embed origin to generate iframe code.</p>
      )}
      <details className="console-disclosure console-link-controls">
        <summary>Manage link</summary>
        <AdminForm action={updateOriginsAction} label="Save changes" variant="outline" className="console-form">
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="instanceId" value={link.instanceId} />
          <OriginsField id={`link-origins-${link.id}`} defaultValue={link.origins.join("\n")} />
        </AdminForm>
        {link.enabled ? (
          <details className="console-disclosure console-disable">
            <summary>Disable link</summary>
            <p>Pages using this link will stop displaying the widget when they reload.</p>
            <AdminForm action={toggleLinkAction} label="Confirm disable" variant="outline" className="console-form">
              <input type="hidden" name="id" value={link.id} />
              <input type="hidden" name="instanceId" value={link.instanceId} />
              <input type="hidden" name="enabled" value="false" />
            </AdminForm>
          </details>
        ) : (
          <AdminForm action={toggleLinkAction} label="Enable link" variant="outline" className="console-form">
            <input type="hidden" name="id" value={link.id} />
            <input type="hidden" name="instanceId" value={link.instanceId} />
            <input type="hidden" name="enabled" value="true" />
          </AdminForm>
        )}
      </details>
    </li>
  );
}

export function WidgetLinks({ widget, links, embedTitle = widget.name, height = 360 }: {
  widget: WidgetInstance;
  links: WidgetLink[];
  embedTitle?: string;
  height?: number;
}) {
  const origin = configuredOrigin(process.env.WIDGET_EMBED_ORIGIN)?.origin ?? null;

  return (
    <div className="console-editor console-stack">
      <section className="console-panel console-form-panel" aria-labelledby="new-link-title">
        <div className="console-panel-title">
          <span className="console-instance-icon"><Plus size={17} aria-hidden="true" /></span>
          <h2 id="new-link-title">Add embed link</h2>
        </div>
        <AdminForm action={createLinkAction} label="Create embed link" className="console-form">
          <input type="hidden" name="instanceId" value={widget.id} />
          <OriginsField id="new-link-origins" />
        </AdminForm>
      </section>

      <section className="console-panel" aria-labelledby="widget-links">
        <header className="console-inventory-header">
          <h2 id="widget-links">Links for this widget</h2>
          <span>{links.length} {links.length === 1 ? "link" : "links"}</span>
        </header>
        {links.length === 0 ? (
          <div className="console-empty">
            <CodeXml size={21} aria-hidden="true" />
            <div><h3>No embed links yet</h3><p>Create a link and choose which sites can display this widget.</p></div>
          </div>
        ) : (
          <ul className="console-records">
            {links.map((link) => <LinkCard key={link.id} link={link} origin={origin} embedTitle={embedTitle} height={height} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
