import Link from "next/link";
import { ArrowLeft, Blocks } from "lucide-react";
import { AdminForm } from "@/components/admin/form";
import { AdminShell } from "@/components/admin/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth";
import { listTemplates } from "@/lib/widgets";
import { createInstanceAction } from "../../actions";

export default async function NewWidgetPage() {
  const { username } = await requireAdmin();
  const templates = listTemplates();

  return (
    <AdminShell username={username}>
      <Link href="/admin" className="console-back"><ArrowLeft size={16} aria-hidden="true" />All widgets</Link>
      <header className="console-page-header">
        <div>
          <h1>New widget</h1>
          <p>Choose a template and give the widget a name.</p>
        </div>
      </header>
      {templates.length > 0 ? (
        <div className="console-panel console-form-panel console-editor">
          <AdminForm action={createInstanceAction} label="Create widget" className="console-form console-form-spacious">
            <div className="console-field">
              <Label htmlFor="new-template">Template</Label>
              <select id="new-template" name="templateKey" className="console-select" defaultValue="" required>
                <option value="" disabled>Select a template</option>
                {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
              </select>
            </div>
            <div className="console-field">
              <Label htmlFor="new-widget-name">Widget name</Label>
              <Input id="new-widget-name" name="name" required maxLength={100} placeholder="e.g. Homepage notice" />
            </div>
          </AdminForm>
        </div>
      ) : (
        <div className="console-panel console-empty">
          <Blocks size={21} aria-hidden="true" />
          <div><h2>No templates available</h2><p>Register a template in this deployment to create a widget.</p></div>
        </div>
      )}
    </AdminShell>
  );
}
