import Link from "next/link";
import { ArrowRight, Blocks, CircleCheck, Plus } from "lucide-react";
import { DeleteWidget } from "@/components/admin/delete-widget";
import { AdminShell } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { listInstances, listLinks, listTemplates } from "@/lib/widgets";

export default async function WidgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  const { username } = await requireAdmin();
  const instances = listInstances();
  const templates = new Map(listTemplates().map((template) => [template.key, template.name]));
  const linkCounts = new Map<string, { total: number; enabled: number }>();
  const { deleted } = await searchParams;

  for (const link of listLinks()) {
    const counts = linkCounts.get(link.instanceId) ?? { total: 0, enabled: 0 };
    counts.total += 1;
    counts.enabled += Number(link.enabled);
    linkCounts.set(link.instanceId, counts);
  }

  return (
    <AdminShell username={username}>
      <header className="console-page-header console-dashboard-header">
        <div>
          <h1>Widgets</h1>
          <p>Configure your widgets, preview them, and manage where they appear.</p>
        </div>
        {templates.size > 0 && (
          <Button asChild>
            <Link href="/admin/widgets/new"><Plus aria-hidden="true" />New widget</Link>
          </Button>
        )}
      </header>

      {deleted === "1" && (
        <p className="console-message console-notice" role="status">
          <CircleCheck size={16} aria-hidden="true" />Widget deleted.
        </p>
      )}

      {instances.length === 0 ? (
        <div className="console-panel console-empty">
          <Blocks size={21} aria-hidden="true" />
          <div>
            <h2>No widgets yet</h2>
            <p>{templates.size > 0 ? "Choose a template to create your first widget." : "The catalog is empty. Register a template in this deployment to create a widget."}</p>
          </div>
        </div>
      ) : (
        <section className="console-panel console-inventory console-widget-inventory" aria-labelledby="saved-widgets">
          <header className="console-inventory-header">
            <h2 id="saved-widgets">All widgets</h2>
            <span>{instances.length} {instances.length === 1 ? "widget" : "widgets"}</span>
          </header>
          <ul className="console-records" role="list">
            {instances.map((widget) => {
              const counts = linkCounts.get(widget.id);
              return (
                <li key={widget.id} className="console-widget-record">
                  <Link
                    href={`/admin/widgets/${widget.id}`}
                    className="console-widget-row"
                    aria-label={`Open ${widget.name}`}
                    aria-describedby={`widget-template-${widget.id} widget-links-${widget.id}`}
                  >
                    <span className="console-instance-icon"><Blocks size={17} aria-hidden="true" /></span>
                    <span className="console-record-name">
                      <strong>{widget.name}</strong>
                      <small id={`widget-template-${widget.id}`}>{templates.get(widget.templateKey) ?? "Unavailable template"}</small>
                    </span>
                    <span className="console-widget-count" id={`widget-links-${widget.id}`}>
                      {counts ? `${counts.enabled} of ${counts.total} active ${counts.total === 1 ? "link" : "links"}` : "No embed links"}
                    </span>
                    <span className="console-widget-open" aria-hidden="true">
                      <span>Open</span><ArrowRight size={16} />
                    </span>
                  </Link>
                  <DeleteWidget id={widget.id} name={widget.name} linkCount={counts?.total ?? 0} compact />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AdminShell>
  );
}
