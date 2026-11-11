import { optionalWidgetText, widgetHttpsUrl } from "../configuration";
import { WidgetError, type WidgetConfiguration, type WidgetConfigurationField, type WidgetInstance } from "../contracts";

const activation = "Display rules";
const content = "Popup content";
const action = "Action link";

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
  ];
});

export const popupFields: readonly WidgetConfigurationField[] = [
  { key: "title", label: "Title", control: "text", section: content },
  { key: "description", label: "Description", control: "textarea", section: content },
  { key: "imageAlt", label: "Image alternative text", description: "Describe information conveyed by the image, including any text visitors need to read.", control: "text", section: content },
  { key: "ctaLabel", label: "Button label", description: "Defaults to Learn more when a button URL is set.", control: "text", section: action },
  { key: "ctaUrl", label: "Button URL", control: "url", section: action },
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
  { key: "sessionLimit", label: "Maximum opens per tab session", description: "Used with the session limit. Defaults to one opening per session.", control: "number", min: 1, max: 20, step: 1, section: activation },
  ...sizeFields,
];

function optionalInteger(input: unknown, label: string, min: number, max: number) {
  if (input === undefined || input === null || input === "") return undefined;
  const value = typeof input === "string" && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new WidgetError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function descriptionText(input: unknown) {
  if (input === undefined || input === null || input === "") return undefined;
  if (typeof input !== "string") throw new WidgetError("Description must be text.");
  const value = input.replace(/\r\n?/g, "\n").trim();
  if (value.length > 1600 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(value)) {
    throw new WidgetError("Description must be plain text of 1,600 characters or fewer.");
  }
  return value || undefined;
}

export function parsePopupSettings(input: unknown): WidgetConfiguration {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new WidgetError("Popup settings must be an object.");
  }
  const value = input as Record<string, unknown>;
  const title = optionalWidgetText(value.title, "Title", 120);
  const description = descriptionText(value.description);
  const imageAlt = optionalWidgetText(value.imageAlt, "Image alternative text", 300);
  const ctaLabel = optionalWidgetText(value.ctaLabel, "Button label", 80);
  const ctaUrl = optionalWidgetText(value.ctaUrl, "Button URL", 2048);
  const trigger = optionalWidgetText(value.trigger, "Open popup", 16);
  const triggerSelector = optionalWidgetText(value.triggerSelector, "Host trigger selector", 240);
  const delaySeconds = optionalInteger(value.delaySeconds, "Delay", 0, 3600);
  const frequency = optionalWidgetText(value.frequency, "Frequency", 16);
  const sessionLimit = optionalInteger(value.sessionLimit, "Session limit", 1, 20);

  if (trigger && trigger !== "click" && trigger !== "delay") {
    throw new WidgetError("Choose a popup trigger.");
  }
  if (frequency && frequency !== "always" && frequency !== "session") {
    throw new WidgetError("Choose a popup frequency.");
  }

  const settings: WidgetConfiguration = {};
  if (title) settings.title = title;
  if (description) settings.description = description;
  if (imageAlt) settings.imageAlt = imageAlt;
  if (ctaLabel) settings.ctaLabel = ctaLabel;
  if (ctaUrl) settings.ctaUrl = widgetHttpsUrl(ctaUrl, "Button URL");
  if (trigger) settings.trigger = trigger;
  if (triggerSelector) settings.triggerSelector = triggerSelector;
  if (delaySeconds !== undefined) settings.delaySeconds = delaySeconds;
  if (frequency) settings.frequency = frequency;
  if (sessionLimit !== undefined) settings.sessionLimit = sessionLimit;

  for (const { key, label, min } of sizeFields) {
    const size = optionalInteger(value[key], label, min ?? minHeight, maxSize);
    if (size !== undefined) settings[key] = size;
  }
  return settings;
}

export function popupSize(instance: WidgetInstance, key: SizeProfile) {
  const { configuration, image } = instance;
  const limits = profiles[key];
  const widthOverride = configuration[`${key}Width`];
  const heightOverride = configuration[`${key}Height`];
  const preferredWidth = typeof widthOverride === "number" ? widthOverride : undefined;
  const preferredHeight = typeof heightOverride === "number" ? heightOverride : undefined;
  if (!image) {
    return { width: preferredWidth ?? Math.min(560, limits.width), height: preferredHeight ?? 380 };
  }

  const ratio = image.width / image.height;
  const hasCopy = Boolean(configuration.title || configuration.description || configuration.ctaUrl);
  const copySpace = hasCopy ? 180 : 0;
  const automaticWidth = Math.min(image.width, limits.width, Math.max(minHeight, (preferredHeight ?? limits.height) - copySpace) * ratio);
  const width = preferredWidth ?? Math.max(hasCopy ? 280 : minWidth, Math.round(automaticWidth));
  const height = preferredHeight ?? Math.min(limits.height, Math.max(minHeight, Math.round(width / ratio) + copySpace));
  return { width, height };
}
