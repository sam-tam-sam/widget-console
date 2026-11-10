type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type WidgetConfiguration = { [key: string]: JsonValue };

export type WidgetAppearance = {
  accent: string;
  background: string;
  surface: string;
};

export type WidgetConfigurationField = {
  key: string;
  label: string;
  description?: string;
  control?: "text" | "url" | "number";
  section?: string;
};

export type WidgetTemplateSummary = {
  key: string;
  name: string;
  description: string;
  configurationFields?: readonly WidgetConfigurationField[];
  appearance?: WidgetAppearance;
  embedHeight?: number;
};

export type WidgetInstance = {
  id: string;
  templateKey: string;
  name: string;
  configuration: WidgetConfiguration;
};

export type WidgetTemplate = WidgetTemplateSummary & {
  clientScript?: string;
  parseConfiguration(value: unknown): WidgetConfiguration;
  render(instance: WidgetInstance): string;
};

export class WidgetError extends Error {
  override name = "WidgetError";
}
