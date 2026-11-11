type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type WidgetConfiguration = { [key: string]: JsonValue };

export type WidgetAppearance = {
  accent: string;
  surface: string;
};

export type WidgetEmbedHeights = {
  compact: number;
  mobile: number;
  wide: number;
};

export type WidgetConfigurationField = {
  key: string;
  label: string;
  description?: string;
  control?: "text" | "url" | "number" | "textarea" | "select" | "datetime-local";
  section?: string;
  tab?: "size";
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
};

export type WidgetPopupProfile = "phone" | "tablet" | "medium" | "desktop";

export type WidgetHostEmbed = {
  kind: "popup";
  trigger: "delay" | "click";
  delayMs: number;
  triggerSelector: string;
  frequency: "always" | "session";
  sessionLimit: number;
  sizes: Record<WidgetPopupProfile, { width: number; height: number }>;
} | {
  kind: "announcement";
  mountSelector: string;
  fixedHeaderSelector: string;
  startsAt: number | null;
  endsAt: number | null;
};

export type WidgetImage = { src: string; width: number; height: number };

export type WidgetTemplateSummary = {
  key: string;
  name: string;
  description: string;
  configurationFields?: readonly WidgetConfigurationField[];
  appearance?: WidgetAppearance;
  embedHeight?: number;
  embedHeights?: Partial<WidgetEmbedHeights>;
  hostEmbed?: WidgetHostEmbed["kind"];
  imageUpload?: boolean;
};

export type WidgetInstance = {
  id: string;
  templateKey: string;
  name: string;
  configuration: WidgetConfiguration;
  approvedOrigins: string[] | null;
  image?: WidgetImage;
};

export type WidgetTemplate = WidgetTemplateSummary & {
  clientScript?: string;
  resolveHostEmbed?(instance: WidgetInstance): WidgetHostEmbed;
  parseConfiguration(value: unknown): WidgetConfiguration;
  render(instance: WidgetInstance): string;
};

export class WidgetError extends Error {
  override name = "WidgetError";
}
