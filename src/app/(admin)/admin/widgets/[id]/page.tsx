import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChartNoAxesColumnIncreasing, Eye, Link2, Paintbrush, Ruler, Settings, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/shell";
import { WidgetLinks } from "@/components/admin/widget-links";
import { WidgetPreview } from "@/components/admin/widget-preview";
import { WidgetOriginsSettings, WidgetSettings, WidgetStyleSettings } from "@/components/admin/widget-settings";
import { WidgetSizeSettings } from "@/components/admin/widget-size-settings";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getInstance, listLinks, listTemplates } from "@/lib/widgets";
import "@/components/admin/widget-sections.css";

const sections = [
  { key: "settings", label: "Settings", query: "", icon: Settings },
  { key: "style", label: "Style", query: "?tab=style", icon: Paintbrush },
  { key: "size", label: "Size", query: "?tab=size", icon: Ruler },
  { key: "preview", label: "Preview", query: "?tab=preview", icon: Eye },
  { key: "origins", label: "Approved origins", query: "?tab=origins", icon: ShieldCheck },
  { key: "links", label: "Embed links", query: "?tab=links", icon: Link2 },
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
  const appearance = template?.appearance;
  const links = listLinks(widget.id);
  const { tab } = await searchParams;
  const availableSections = sections.filter(({ key }) => key !== "style" || appearance);
  const section = availableSections.find(({ key }) => key === tab)?.key ?? "settings";
  const path = `/admin/widgets/${widget.id}`;

  let content;
  switch (section) {
    case "style":
      if (appearance) content = <WidgetStyleSettings widget={widget} appearance={appearance} />;
      break;
    case "size":
      content = <WidgetSizeSettings widget={widget} template={template} />;
      break;
    case "preview":
      content = <WidgetPreview instanceId={widget.id} />;
      break;
    case "origins":
      content = <WidgetOriginsSettings widget={widget} linkCount={links.length} />;
      break;
    case "links":
      content = <WidgetLinks widget={widget} links={links} template={template} />;
      break;
    default:
      content = <WidgetSettings widget={widget} template={template} linkCount={links.length} />;
  }

  return (
    <AdminShell username={username}>
      <Link href="/admin" className="console-back"><ArrowLeft size={16} aria-hidden="true" />All widgets</Link>
      <header className="console-page-header">
        <div>
          <h1>{widget.name}</h1>
          <p>{template?.name ?? "Unavailable template"}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/analytics/${widget.id}`}><ChartNoAxesColumnIncreasing aria-hidden="true" />View analytics</Link>
        </Button>
      </header>
      <nav className="console-widget-tabs" aria-label="Widget sections">
        {availableSections.map(({ key, label, query, icon: Icon }) => (
          <Link
            key={key}
            id={key === "origins" ? "widget-approved-origins" : undefined}
            href={path + query}
            aria-current={section === key ? "page" : undefined}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="console-tab-content">{content}</div>
    </AdminShell>
  );
}
