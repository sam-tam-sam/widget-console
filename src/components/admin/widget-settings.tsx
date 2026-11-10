import { updateInstanceAction, updateWidgetOriginsAction } from "@/app/(admin)/admin/actions";
import { AdminForm } from "@/components/admin/form";
import { DeleteWidget } from "@/components/admin/delete-widget";
import { WidgetAppearanceFields } from "@/components/admin/widget-appearance-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveWidgetAppearance } from "@/widgets/appearance";
import type { WidgetConfigurationField, WidgetInstance, WidgetTemplateSummary } from "@/widgets/contracts";

function ConfigurationField({ field, value }: { field: WidgetConfigurationField; value: unknown }) {
  const id = `widget-field-${field.key}`;
  const input = {
    id,
    name: `config.${field.key}`,
    defaultValue: typeof value === "string" || typeof value === "number" ? value : "",
    "aria-describedby": field.description ? `${id}-help` : undefined,
  };
  return (
    <div className="console-field">
      <Label htmlFor={id}>{field.label}</Label>
      {field.control ? (
        <Input
          {...input}
          type={field.control}
          min={field.control === "number" ? 0 : undefined}
          step={field.control === "number" ? "any" : undefined}
        />
      ) : (
        <textarea {...input} className="console-text-field" rows={4} />
      )}
      {field.description && <small id={`${id}-help`}>{field.description}</small>}
    </div>
  );
}

export function WidgetSettings({
  widget,
  template,
  linkCount,
}: {
  widget: WidgetInstance;
  template?: WidgetTemplateSummary;
  linkCount: number;
}) {
  const sections = new Map<string, WidgetConfigurationField[]>();
  for (const field of template?.configurationFields ?? []) {
    const section = field.section ?? "";
    const fields = sections.get(section) ?? [];
    fields.push(field);
    sections.set(section, fields);
  }
  const appearance = template?.appearance;
  const colors = appearance ? resolveWidgetAppearance(appearance, widget.configuration) : null;
  const approvedOrigins = widget.approvedOrigins?.join("\n") ?? "";

  return (
    <div className="console-editor console-stack">
      <section className="console-panel console-form-panel" aria-labelledby="widget-settings-heading">
        <div className="console-section-heading">
          <h2 id="widget-settings-heading">Widget settings</h2>
          <p>Saved changes apply to this widget and its existing embed links.</p>
        </div>
        <AdminForm action={updateInstanceAction} label="Save settings" className="console-form console-form-spacious">
          <input type="hidden" name="id" value={widget.id} />
          <div className="console-field">
            <Label htmlFor="widget-name">Widget name</Label>
            <Input id="widget-name" name="name" defaultValue={widget.name} required maxLength={100} />
          </div>
          {[...sections].map(([section, fields]) => {
            const controls = fields.map((field) => (
              <ConfigurationField key={field.key} field={field} value={widget.configuration[field.key]} />
            ));
            return section ? (
              <fieldset key={section} className="console-setting-group">
                <legend>{section}</legend>
                <div className="console-setting-grid">{controls}</div>
              </fieldset>
            ) : controls;
          })}
          {template && !template.configurationFields && (
            <details className="console-disclosure">
              <summary>Advanced configuration</summary>
              <div className="console-field">
                <Label htmlFor="widget-configuration">Configuration JSON</Label>
                <textarea
                  id="widget-configuration"
                  name="configuration"
                  className="console-code-field"
                  defaultValue={JSON.stringify(widget.configuration, null, 2)}
                  rows={4}
                  spellCheck={false}
                  maxLength={16_384}
                />
              </div>
            </details>
          )}
          {appearance && colors && (
            <WidgetAppearanceFields
              key={`${widget.id}:${colors.accent}:${colors.background}:${colors.surface}`}
              defaults={appearance}
              initial={colors}
            />
          )}
        </AdminForm>
      </section>
      <section id="widget-approved-origins" className="console-panel console-form-panel" aria-labelledby="widget-approved-origins-heading">
        <div className="console-section-heading">
          <h2 id="widget-approved-origins-heading">Approved origins</h2>
          <p>The saved list applies to every embed link for this widget.</p>
          {widget.approvedOrigins === null && linkCount > 0 && (
            <p>Existing links use their previous site lists until you save this list.</p>
          )}
        </div>
        <AdminForm action={updateWidgetOriginsAction} label="Save approved origins" className="console-form">
          <input type="hidden" name="id" value={widget.id} />
          <div className="console-field">
            <Label htmlFor="widget-approved-origins-list">Approved origins</Label>
            <textarea
              key={approvedOrigins}
              id="widget-approved-origins-list"
              name="origins"
              className="console-code-field"
              defaultValue={approvedOrigins}
              rows={4}
              maxLength={8192}
              spellCheck={false}
              placeholder="https://example.com"
              aria-describedby="widget-approved-origins-help"
            />
            <small id="widget-approved-origins-help">Enter one HTTPS origin per line, including its port if present. An empty list blocks embedding. You can still preview the widget in the dashboard.</small>
          </div>
        </AdminForm>
      </section>
      <section className="console-panel console-form-panel console-danger" aria-labelledby="delete-widget-heading">
        <div>
          <h2 id="delete-widget-heading">Delete this widget</h2>
          <p>Permanently remove this widget and its embed links.</p>
        </div>
        <DeleteWidget id={widget.id} name={widget.name} linkCount={linkCount} />
      </section>
    </div>
  );
}
