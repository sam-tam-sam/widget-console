import { CodeXml, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { createLinkAction, toggleLinkAction } from "@/app/(admin)/admin/actions";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { EmbedCode } from "@/components/admin/embed-code";
import { AdminForm } from "@/components/admin/form";
import { applicationOrigin } from "@/lib/embeds";
import type { WidgetLink } from "@/lib/widgets";
import type { WidgetEmbedHeights, WidgetInstance, WidgetTemplateSummary } from "@/widgets/contracts";
import { resolveWidgetEmbedHeights, widgetEmbedProfiles } from "@/widgets/embed-size";
import { escapeHtml } from "@/widgets/html";

function makeEmbedMarkup(origin: string, id: string, title: string, heights: WidgetEmbedHeights) {
  const src = new URL(`/embed/${encodeURIComponent(id)}`, origin).href;
  const className = `widget-console-embed-${id.replace(/[^a-f0-9-]/g, "")}`;
  const rules = [...widgetEmbedProfiles].reverse().flatMap(({ key, maxWidth }) => maxWidth === undefined
    ? []
    : [`    @container (max-width: ${maxWidth}px) { .${className} { height: var(--widget-height-${key}); } }`]);
  return [
    '<div style="container-type:inline-size;width:100%">',
    "  <style>",
    ...rules,
    "  </style>",
    `  <iframe class="${className}" src="${escapeHtml(src)}" title="${escapeHtml(title)}" width="100%" height="${heights.wide}" style="display:block;width:100%;border:0;--widget-height-compact:${heights.compact}px;--widget-height-mobile:${heights.mobile}px" loading="lazy"></iframe>`,
    "</div>",
  ].join("\n");
}

function LinkCard({ link, origin, embedTitle, heights }: {
  link: WidgetLink;
  origin: string | null;
  embedTitle: string;
  heights: WidgetEmbedHeights;
}) {
  return (
    <li data-link-id={link.id} className="console-link-record">
      <div className="console-link-heading">
        <span className="console-instance-icon"><Link2 size={17} aria-hidden="true" /></span>
        <div className="console-record-name">
          <h3>Embed link</h3>
          <small>{link.id.slice(0, 8)}</small>
        </div>
        <span className="console-badge" aria-live="polite" data-enabled={link.enabled}>
          <span aria-hidden="true" />{link.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      {origin ? (
        <EmbedCode markup={makeEmbedMarkup(origin, link.id, embedTitle, heights)} />
      ) : (
        <p className="console-empty-note">Configure the application origin to generate iframe code.</p>
      )}
      <details className="console-disclosure console-link-controls">
        <summary>Manage link</summary>
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

export function WidgetLinks({ widget, links, template }: {
  widget: WidgetInstance;
  links: WidgetLink[];
  template?: WidgetTemplateSummary;
}) {
  const origin = applicationOrigin()?.origin ?? null;
  const originsPath = `/admin/widgets/${encodeURIComponent(widget.id)}?tab=origins`;
  const heights = resolveWidgetEmbedHeights(template, widget.configuration.embedHeights);
  const current = links[0];

  return (
    <div className="console-editor console-stack">
      <section className="console-panel console-form-panel" aria-labelledby="new-link-title">
        <div className="console-panel-title">
          <span className="console-instance-icon"><Plus size={17} aria-hidden="true" /></span>
          <h2 id="new-link-title">Publish this widget</h2>
        </div>
        <p className="console-empty-note">Choose which sites can display this widget in <Link href={originsPath} className="underline">Approved origins</Link>.</p>
        <ConfirmAction
          action={createLinkAction}
          label="Create embed link"
          confirmation={current ? {
            title: "Replace embed link?",
            label: "Replace link",
            description: links.length > 1
              ? `All ${links.length} existing links will stop working. Copy the new code to any page that uses this widget.`
              : "The existing link will stop working. Copy the new code to any page that uses this widget.",
          } : undefined}
        >
          <input type="hidden" name="instanceId" value={widget.id} />
          {current && <input type="hidden" name="previousLinkId" value={current.id} />}
        </ConfirmAction>
      </section>

      <section className="console-panel" aria-labelledby="widget-links">
        <header className="console-inventory-header">
          <h2 id="widget-links">Current embed link</h2>
          {links.length > 1 && <span>{links.length} existing links</span>}
        </header>
        {!current ? (
          <div className="console-empty">
            <CodeXml size={21} aria-hidden="true" />
            <div><h3>No embed link yet</h3><p>Create a link to get the iframe code for this widget.</p></div>
          </div>
        ) : (
          <ul className="console-records">
            <LinkCard key={current.id} link={current} origin={origin} embedTitle={template?.name ?? widget.name} heights={heights} />
          </ul>
        )}
      </section>
    </div>
  );
}
