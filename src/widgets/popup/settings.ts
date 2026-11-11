import { optionalWidgetText, widgetHttpsUrl } from "../configuration";
import { WidgetError, type WidgetConfiguration, type WidgetConfigurationField, type WidgetInstance } from "../contracts";

const activation = "Display rules";
const imageDetails = "Image details";

const profiles = {
  phone: { label: "Phone", range: "Below 600px", width: 360, height: 560 },
  tablet: { label: "Tablet", range: "600–899px", width: 600, height: 680 },
  medium: { label: "Medium", range: "900–1199px", width: 760, height: 760 },
  desktop: { label: "Desktop", range: "1200px and up", width: 960, height: 880 },
} as const;

type SizeProfile = keyof typeof profiles;
const profileKeys = Object.keys(profiles) as SizeProfile[];
const minWidth = 160;
const minHeight = 120;
const maxSize = 2400;

const sizeFields = profileKeys.flatMap((key): WidgetConfigurationField[] => {
  const { label, range } = profiles[key];
  return [
    { key: `${key}Width`, label: `${label} width (px)`, description: `${range}. Leave blank for automatic sizing.`, control: "number", min: minWidth, max: maxSize, step: 1, section: label, tab: "size" },
    { key: `${key}Height`, label: `${label} height (px)`, control: "number", min: minHeight, max: maxSize, step: 1, section: label, tab: "size" },
    { key: `${key}Scale`, label: `${label} scale (%)`, description: "Scales the whole popup while keeping the width and height settings.", control: "range", min: 10, max: 100, step: 1, section: label, tab: "size" },
  ];
});

export const popupFields: readonly WidgetConfigurationField[] = [
  { key: "imageAlt", label: "Image alternative text", description: "Describe information conveyed by the image, including any text visitors need to read.", control: "text", section: imageDetails },
  { key: "ctaUrl", label: "Image link URL", description: "Optional. Clicking the image opens this link in a new tab.", control: "url", section: imageDetails },
  { key: "trigger", label: "Open popup", control: "select", section: activation, options: [
    { value: "delay", label: "After a delay" },
    { value: "click", label: "On host element click" },
  ] },
  { key: "delaySeconds", label: "Delay (seconds)", description: "Used for delayed opening. Defaults to 2 seconds.", control: "number", min: 0, max: 3600, step: 1, section: activation },
  { key: "triggerSelector", label: "Host trigger selector", description: "Used for click opening. Defaults to #widget-popup-trigger. Use a CSS selector for an existing button or link.", control: "text", section: activation },
  { key: "frequency", label: "Frequency", control: "select", section: activation, options: [
    { value: "session", label: "Limit per browser tab session" },
    { value: "always", label: "Every time it is triggered" },
  ] },
  { key: "sessionLimit", label: "Maximum opens per tab session", description: "Enter a positive whole number. Defaults to one opening per session.", control: "number", min: 1, step: 1, section: activation },
  ...sizeFields,
];

function optionalInteger(input: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (input === undefined || input === null || input === "") return undefined;
  const value = typeof input === "string" && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new WidgetError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

export function parsePopupSettings(input: unknown): WidgetConfiguration {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new WidgetError("Popup settings must be an object.");
  }
  const value = input as Record<string, unknown>;
  const imageAlt = optionalWidgetText(value.imageAlt, "Image alternative text", 300);
  const ctaUrl = optionalWidgetText(value.ctaUrl, "Image link URL", 2048);
  const trigger = optionalWidgetText(value.trigger, "Open popup", 16);
  const triggerSelector = optionalWidgetText(value.triggerSelector, "Host trigger selector", 240);
  const delaySeconds = optionalInteger(value.delaySeconds, "Delay", 0, 3600);
  const frequency = optionalWidgetText(value.frequency, "Frequency", 16);
  const sessionLimit = optionalInteger(value.sessionLimit, "Session limit", 1);

  if (trigger && trigger !== "click" && trigger !== "delay") {
    throw new WidgetError("Choose a popup trigger.");
  }
  if (frequency && frequency !== "always" && frequency !== "session") {
    throw new WidgetError("Choose a popup frequency.");
  }
  const settings: WidgetConfiguration = {};
  if (imageAlt) settings.imageAlt = imageAlt;
  if (ctaUrl) settings.ctaUrl = widgetHttpsUrl(ctaUrl, "Image link URL");
  if (trigger) settings.trigger = trigger;
  if (triggerSelector) settings.triggerSelector = triggerSelector;
  if (delaySeconds !== undefined) settings.delaySeconds = delaySeconds;
  if (frequency) settings.frequency = frequency;
  if (sessionLimit !== undefined) settings.sessionLimit = sessionLimit;

  for (const { key, label, min, max } of sizeFields) {
    const size = optionalInteger(value[key], label, min ?? minHeight, max ?? maxSize);
    if (size !== undefined) settings[key] = size;
  }
  return settings;
}

export function popupSize(instance: WidgetInstance, key: SizeProfile) {
  const { configuration, image } = instance;
  const limits = profiles[key];
  const widthOverride = configuration[`${key}Width`];
  const heightOverride = configuration[`${key}Height`];
  const scaleOverride = configuration[`${key}Scale`];
  const scale = typeof scaleOverride === "number" ? scaleOverride : 100;
  const preferredWidth = typeof widthOverride === "number" ? widthOverride : undefined;
  const preferredHeight = typeof heightOverride === "number" ? heightOverride : undefined;
  if (!image) {
    return { width: preferredWidth ?? Math.min(560, limits.width), height: preferredHeight ?? 380, scale };
  }

  const ratio = image.width / image.height;
  const automaticWidth = Math.min(image.width, limits.width, (preferredHeight ?? limits.height) * ratio);
  const width = preferredWidth ?? Math.max(minWidth, Math.round(automaticWidth));
  const height = preferredHeight ?? Math.min(limits.height, Math.max(minHeight, Math.round(width / ratio)));
  return { width, height, scale };
}
