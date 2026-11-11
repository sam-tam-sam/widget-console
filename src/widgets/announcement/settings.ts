import { optionalWidgetText, widgetHttpsUrl } from "../configuration";
import { WidgetError, type WidgetConfiguration, type WidgetConfigurationField } from "../contracts";

const content = "Announcement content";
const action = "Action link";
const placement = "Host placement";
const schedule = "Schedule (UTC)";

const icons = [
  { value: "none", label: "None" },
  { value: "info", label: "Information" },
  { value: "calendar", label: "Calendar" },
  { value: "megaphone", label: "Megaphone" },
] as const;

export const announcementFields: readonly WidgetConfigurationField[] = [
  { key: "message", label: "Announcement text", control: "text", section: content },
  { key: "icon", label: "Icon", control: "select", section: content, options: icons },
  { key: "dismissible", label: "Close button", control: "select", section: content, options: [
    { value: "yes", label: "Show close button" },
    { value: "no", label: "Hide close button" },
  ] },
  { key: "ctaLabel", label: "Button label", description: "Defaults to Learn more when a button URL is set.", control: "text", section: action },
  { key: "ctaUrl", label: "Button URL", control: "url", section: action },
  { key: "mountSelector", label: "Mount selector", description: "Use a CSS selector for a dedicated container above the header. Defaults to #widget-announcement.", control: "text", section: placement },
  { key: "fixedHeaderSelector", label: "Fixed header selector", description: "Optional CSS selector for the fixed header to offset by the visible bar height.", control: "text", section: placement },
  { key: "startsAt", label: "Start time (UTC)", description: "Leave blank to start immediately.", control: "datetime-local", section: schedule },
  { key: "endsAt", label: "End time (UTC)", description: "Leave blank to keep displaying the announcement.", control: "datetime-local", section: schedule },
];

function utcSetting(input: unknown, label: string) {
  const value = optionalWidgetText(input, label, 16);
  if (!value) return undefined;
  const date = new Date(`${value}:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
      value.startsWith("0000") ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 16) !== value) {
    throw new WidgetError(`Enter a valid UTC date and time for ${label}.`);
  }
  return value;
}

export function announcementTime(input: unknown) {
  return typeof input === "string" ? Date.parse(`${input}:00Z`) : null;
}

export function parseAnnouncementSettings(input: unknown): WidgetConfiguration {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new WidgetError("Announcement settings must be an object.");
  }
  const value = input as Record<string, unknown>;
  const message = optionalWidgetText(value.message, "Announcement text", 300);
  const ctaLabel = optionalWidgetText(value.ctaLabel, "Button label", 80);
  const ctaUrl = optionalWidgetText(value.ctaUrl, "Button URL", 2048);
  const icon = optionalWidgetText(value.icon, "Icon", 16);
  const dismissible = optionalWidgetText(value.dismissible, "Close button", 3);
  const mountSelector = optionalWidgetText(value.mountSelector, "Mount selector", 240);
  const fixedHeaderSelector = optionalWidgetText(value.fixedHeaderSelector, "Fixed header selector", 240);
  const startsAt = utcSetting(value.startsAt, "start time");
  const endsAt = utcSetting(value.endsAt, "end time");

  if (icon && !icons.some(({ value }) => icon === value)) {
    throw new WidgetError("Choose an announcement icon.");
  }
  if (dismissible && dismissible !== "yes" && dismissible !== "no") {
    throw new WidgetError("Choose whether to show a close button.");
  }
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new WidgetError("The UTC end time must be after the UTC start time.");
  }

  const settings: WidgetConfiguration = {};
  if (message) settings.message = message;
  if (ctaLabel) settings.ctaLabel = ctaLabel;
  if (ctaUrl) settings.ctaUrl = widgetHttpsUrl(ctaUrl, "Button URL");
  if (icon) settings.icon = icon;
  if (dismissible) settings.dismissible = dismissible;
  if (mountSelector) settings.mountSelector = mountSelector;
  if (fixedHeaderSelector) settings.fixedHeaderSelector = fixedHeaderSelector;
  if (startsAt) settings.startsAt = startsAt;
  if (endsAt) settings.endsAt = endsAt;
  return settings;
}
