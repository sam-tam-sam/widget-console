import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WidgetConfiguration, WidgetConfigurationField } from "@/widgets/contracts";
import { WidgetRangeField } from "./widget-range-field";

function ConfigurationField({ field, value, placeholder }: {
  field: WidgetConfigurationField;
  value: unknown;
  placeholder?: string;
}) {
  const id = `widget-field-${field.key}`;
  const input = {
    id,
    name: `config.${field.key}`,
    defaultValue: typeof value === "string" || typeof value === "number" ? String(value) : field.options?.[0]?.value ?? "",
    "aria-describedby": field.description ? `${id}-help` : undefined,
  };
  return (
    <div className={field.control === "range" ? "console-field console-range-field" : "console-field"}>
      <Label htmlFor={id}>{field.label}</Label>
      {field.control === "range" ? (
        <WidgetRangeField {...input} defaultValue={input.defaultValue || placeholder || String(field.max)} min={field.min} max={field.max} step={field.step} />
      ) : field.control === "select" ? (
        <select {...input} className="console-select">
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.control && field.control !== "textarea" ? (
        <Input
          {...input}
          type={field.control}
          min={field.control === "number" ? field.min ?? 0 : undefined}
          max={field.max}
          step={field.control === "number" ? field.step ?? "any" : undefined}
          placeholder={placeholder}
        />
      ) : (
        <textarea {...input} className="console-text-field" rows={4} />
      )}
      {field.description && <small id={`${id}-help`}>{field.description}</small>}
    </div>
  );
}

export function WidgetConfigurationFields({ fields, values, placeholders }: {
  fields: readonly WidgetConfigurationField[];
  values: WidgetConfiguration;
  placeholders?: Record<string, string>;
}) {
  const sections = new Map<string, WidgetConfigurationField[]>();
  for (const field of fields) {
    const section = field.section ?? "";
    const group = sections.get(section) ?? [];
    group.push(field);
    sections.set(section, group);
  }

  return [...sections].map(([section, group]) => {
    const controls = group.map((field) => (
      <ConfigurationField
        key={`${field.key}:${String(values[field.key] ?? "")}`}
        field={field}
        value={values[field.key]}
        placeholder={placeholders?.[field.key]}
      />
    ));
    return section ? (
      <fieldset key={section} className="console-setting-group">
        <legend>{section}</legend>
        <div className="console-setting-grid">{controls}</div>
      </fieldset>
    ) : controls;
  });
}
