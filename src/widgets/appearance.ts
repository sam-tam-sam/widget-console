import { WidgetError, type WidgetAppearance, type WidgetConfiguration } from "./contracts";

export const widgetAppearanceFields = [
  { key: "accent", label: "Accent color" },
  { key: "surface", label: "Panel background" },
] as const;

export const widgetColorPattern = "#[0-9a-fA-F]{6}";
const hexColor = new RegExp(`^${widgetColorPattern}$`);

export function widgetAppearanceInputName(key: keyof WidgetAppearance) {
  return `appearance.${key}`;
}

export function parseWidgetAppearance(value: unknown, defaults: WidgetAppearance): Partial<WidgetAppearance> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WidgetError("Widget colors must be an object.");
  }

  const overrides: Partial<WidgetAppearance> = {};
  for (const { key, label } of widgetAppearanceFields) {
    const color = (value as Record<string, unknown>)[key];
    if (color === undefined || color === "") continue;
    if (typeof color !== "string" || !hexColor.test(color)) {
      throw new WidgetError(`${label} must be a six-digit hex color such as #4a2170.`);
    }
    const normalized = color.toLowerCase();
    if (normalized !== defaults[key].toLowerCase()) overrides[key] = normalized;
  }
  return overrides;
}

export function resolveWidgetAppearance(defaults: WidgetAppearance, configuration: WidgetConfiguration): WidgetAppearance {
  return { ...defaults, ...parseWidgetAppearance(configuration.appearance, defaults) };
}

function rgb(color: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

function luminance(color: string) {
  const [red, green, blue] = rgb(color).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readableOn(background: string, preferred: string) {
  if (contrast(background, preferred) >= 4.5) return preferred;
  return contrast(background, "#000000") >= 4.5 ? "#000000" : "#ffffff";
}

function mix(base: string, tint: string, weight: number) {
  const tintChannels = rgb(tint);
  return "#" + rgb(base).map((channel, index) =>
    Math.round(channel + (tintChannels[index] - channel) * weight).toString(16).padStart(2, "0"),
  ).join("");
}

export function widgetAppearanceCss(defaults: WidgetAppearance, configuration: WidgetConfiguration) {
  const { accent, surface } = resolveWidgetAppearance(defaults, configuration);
  const accentSoft = mix(surface, accent, 0.09);
  const onSurface = readableOn(surface, "#112446");
  const accentInk = readableOn(surface, accent);

  return `:root {
    --widget-accent: ${accent};
    --widget-surface: ${surface};
    --widget-on-accent: ${readableOn(accent, "#ffffff")};
    --widget-on-surface: ${onSurface};
    --widget-accent-ink: ${accentInk};
    --widget-accent-soft: ${accentSoft};
    --widget-on-accent-soft: ${readableOn(accentSoft, accentInk)};
    --widget-border: ${mix(surface, onSurface, 0.21)};
    --widget-focus: ${accentInk};
  }`;
}
