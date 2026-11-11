import { updateInstanceAction, updateWidgetOriginsAction } from "@/app/(admin)/admin/actions";
import { AdminForm } from "@/components/admin/form";
import { DeleteWidget } from "@/components/admin/delete-widget";
import { WidgetAppearanceFields } from "@/components/admin/widget-appearance-fields";
import { WidgetConfigurationFields } from "@/components/admin/widget-configuration-fields";
import { WidgetImageSettings } from "@/components/admin/widget-image-settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveWidgetAppearance } from "@/widgets/appearance";
import type { WidgetAppearance, WidgetInstance, WidgetTemplateSummary } from "@/widgets/contracts";

export function WidgetSettings({
  widget,
  template,
  linkCount,
}: {
  widget: WidgetInstance;
  template?: WidgetTemplateSummary;
  linkCount: number;
}) {
  const fields = template?.configurationFields?.filter(({ tab }) => tab !== "size") ?? [];
  const templateConfiguration = { ...widget.configuration };
  delete templateConfiguration.appearance;
  delete templateConfiguration.embedHeights;

  return (
    <div className="console-editor console-stack">
      {template?.imageUpload && <WidgetImageSettings id={widget.id} image={widget.image} />}
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
          <WidgetConfigurationFields fields={fields} values={widget.configuration} />
          {template && !template.configurationFields && (
            <details className="console-disclosure">
              <summary>Advanced configuration</summary>
              <div className="console-field">
                <Label htmlFor="widget-configuration">Configuration JSON</Label>
                <textarea
                  id="widget-configuration"
                  name="configuration"
                  className="console-code-field"
                  defaultValue={JSON.stringify(templateConfiguration, null, 2)}
                  rows={4}
                  spellCheck={false}
                  maxLength={16_384}
                />
              </div>
            </details>
          )}
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

export function WidgetOriginsSettings({ widget, linkCount }: { widget: WidgetInstance; linkCount: number }) {
  const approvedOrigins = widget.approvedOrigins?.join("\n") ?? "";

  return (
    <div className="console-editor">
      <section className="console-panel console-form-panel" aria-labelledby="widget-approved-origins-heading">
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
    </div>
  );
}

export function WidgetStyleSettings({ widget, appearance }: { widget: WidgetInstance; appearance: WidgetAppearance }) {
  const colors = resolveWidgetAppearance(appearance, widget.configuration);
  return (
    <div className="console-editor">
      <section className="console-panel console-form-panel" aria-labelledby="widget-style-heading">
        <div className="console-section-heading">
          <h2 id="widget-style-heading">Widget style</h2>
          <p>Set colors for this widget. The outer background stays transparent on the page where you embed it.</p>
        </div>
        <AdminForm action={updateInstanceAction} label="Save style" className="console-form console-form-spacious">
          <input type="hidden" name="id" value={widget.id} />
          <WidgetAppearanceFields
            key={`${widget.id}:${colors.accent}:${colors.surface}`}
            defaults={appearance}
            initial={colors}
          />
        </AdminForm>
      </section>
    </div>
  );
}
