import { updateWidgetSizeAction } from "@/app/(admin)/admin/actions";
import { AdminForm } from "@/components/admin/form";
import { WidgetConfigurationFields } from "@/components/admin/widget-configuration-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renderInstancePreview } from "@/lib/widgets";
import type { WidgetInstance, WidgetTemplateSummary } from "@/widgets/contracts";
import {
  defaultWidgetEmbedHeights,
  maxEmbedHeight,
  minEmbedHeight,
  parseWidgetEmbedHeights,
  widgetEmbedHeightInputName,
  widgetEmbedProfiles,
} from "@/widgets/embed-size";

export function WidgetSizeSettings({ widget, template }: { widget: WidgetInstance; template?: WidgetTemplateSummary }) {
  if (template?.hostEmbed) {
    const fields = template.configurationFields?.filter(({ tab }) => tab === "size") ?? [];
    const hostEmbed = renderInstancePreview(widget.id)?.hostEmbed;
    const placeholders: Record<string, string> = {};
    if (hostEmbed) {
      for (const [device, { width, height, scale }] of Object.entries(hostEmbed.sizes)) {
        placeholders[`${device}Width`] = String(width);
        placeholders[`${device}Height`] = String(height);
        placeholders[`${device}Scale`] = String(scale);
      }
    }
    return (
      <div className="console-editor">
        <section className="console-panel console-form-panel" aria-labelledby="widget-size-heading">
          <div className="console-section-heading">
            <h2 id="widget-size-heading">Popup dimensions</h2>
            <p>Set the width, height, and visual scale for each screen. Leave a dimension empty to use its automatic size.</p>
          </div>
          <AdminForm action={updateWidgetSizeAction} label="Save sizes" className="console-form console-form-spacious">
            <input type="hidden" name="id" value={widget.id} />
            <WidgetConfigurationFields fields={fields} values={widget.configuration} placeholders={placeholders} />
          </AdminForm>
        </section>
      </div>
    );
  }

  const defaults = defaultWidgetEmbedHeights(template);
  const overrides = parseWidgetEmbedHeights(widget.configuration.embedHeights, defaults);

  return (
    <div className="console-editor">
      <section className="console-panel console-form-panel" aria-labelledby="widget-size-heading">
        <div className="console-section-heading">
          <h2 id="widget-size-heading">Embed size</h2>
          <p>Set the iframe height for each width. Leave a field empty to use the template default.</p>
        </div>
        <AdminForm action={updateWidgetSizeAction} label="Save sizes" className="console-form console-form-spacious">
          <input type="hidden" name="id" value={widget.id} />
          <fieldset className="console-setting-group">
            <legend>Height in pixels</legend>
            <div className="console-setting-grid console-size-grid">
              {widgetEmbedProfiles.map(({ key, label, description }) => {
                const id = `widget-height-${key}`;
                return (
                  <div className="console-field" key={id}>
                    <Label htmlFor={id}>{label} height</Label>
                    <Input
                      key={overrides[key] ?? "default"}
                      id={id}
                      name={widgetEmbedHeightInputName(key)}
                      type="number"
                      min={minEmbedHeight}
                      max={maxEmbedHeight}
                      step={1}
                      defaultValue={overrides[key]}
                      placeholder={String(defaults[key])}
                      aria-describedby={`${id}-help`}
                    />
                    <small id={`${id}-help`}>{description} Default height is {defaults[key]}px.</small>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <p className="console-empty-note">After saving, copy the updated embed code to any page where you already use this widget.</p>
        </AdminForm>
      </section>
    </div>
  );
}
