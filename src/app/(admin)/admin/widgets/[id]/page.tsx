import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/shell";
import { WidgetLinks } from "@/components/admin/widget-links";
import { WidgetPreview } from "@/components/admin/widget-preview";
import { WidgetSettings } from "@/components/admin/widget-settings";
import { requireAdmin } from "@/lib/auth";
import { getInstance, listLinks, listTemplates } from "@/lib/widgets";

const sections = [
  { key: "settings", label: "Settings", query: "" },
  { key: "preview", label: "Preview", query: "?tab=preview" },
  { key: "links", label: "Embed links", query: "?tab=links" },
] as const;

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { username } = await requireAdmin();
  const { id } = await params;
  const widget = getInstance(id);
  if (!widget) notFound();

  const template = listTemplates().find(({ key }) => key === widget.templateKey);
  const links = listLinks(widget.id);
  const { tab } = await searchParams;
  const section = tab === "links" || tab === "preview" ? tab : "settings";
  const path = `/admin/widgets/${widget.id}`;

  return (
    <AdminShell username={username}>
      <Link href="/admin" className="console-back"><ArrowLeft size={16} aria-hidden="true" />All widgets</Link>
      <header className="console-page-header">
        <div>
          <h1>{widget.name}</h1>
          <p>{template?.name ?? "Unavailable template"}</p>
        </div>
      </header>
      <nav className="console-tabs" aria-label="Widget sections">
        {sections.map(({ key, label, query }) => (
          <Link key={key} href={path + query} aria-current={section === key ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="console-tab-content">
        {section === "preview" ? (
          <WidgetPreview instanceId={widget.id} />
        ) : section === "links" ? (
          <WidgetLinks widget={widget} links={links} embedTitle={template?.name} height={template?.embedHeight} />
        ) : (
          <WidgetSettings widget={widget} template={template} linkCount={links.length} />
        )}
      </div>
    </AdminShell>
  );
}
