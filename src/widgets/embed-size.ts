import { WidgetError, type WidgetEmbedHeights, type WidgetTemplateSummary } from "./contracts";

export const minEmbedHeight = 240;
export const maxEmbedHeight = 2400;

export const widgetEmbedProfiles = [
  { key: "compact", label: "320px", previewWidth: 320, maxWidth: 359, description: "Containers up to 359px wide." },
  { key: "mobile", label: "390px", previewWidth: 390, maxWidth: 600, description: "Containers from 360px to 600px wide." },
  { key: "wide", label: "Wide", previewWidth: undefined, maxWidth: undefined, description: "Containers wider than 600px." },
] as const;

export function widgetEmbedHeightInputName(key: keyof WidgetEmbedHeights) {
  return `embedHeights.${key}`;
}

export function defaultWidgetEmbedHeights(template?: WidgetTemplateSummary): WidgetEmbedHeights {
  const fallback = template?.embedHeight ?? 360;
  return { compact: fallback, mobile: fallback, wide: fallback, ...template?.embedHeights };
}

export function parseWidgetEmbedHeights(value: unknown, defaults: WidgetEmbedHeights): Partial<WidgetEmbedHeights> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WidgetError("Embed heights must be an object.");
  }

  const overrides: Partial<WidgetEmbedHeights> = {};
  for (const { key, label } of widgetEmbedProfiles) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry === undefined || entry === "") continue;
    const height = typeof entry === "string" && /^\d+$/.test(entry) ? Number(entry) : entry;
    if (typeof height !== "number" || !Number.isInteger(height) || height < minEmbedHeight || height > maxEmbedHeight) {
      throw new WidgetError(`${label} height must be a whole number from ${minEmbedHeight} to ${maxEmbedHeight} pixels.`);
    }
    if (height !== defaults[key]) overrides[key] = height;
  }
  return overrides;
}

export function resolveWidgetEmbedHeights(template: WidgetTemplateSummary | undefined, value: unknown): WidgetEmbedHeights {
  const defaults = defaultWidgetEmbedHeights(template);
  return { ...defaults, ...parseWidgetEmbedHeights(value, defaults) };
}
