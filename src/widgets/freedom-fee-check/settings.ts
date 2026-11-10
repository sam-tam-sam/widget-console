import { optionalWidgetText, widgetHttpsUrl } from "../configuration";
import { WidgetError, type WidgetConfiguration, type WidgetConfigurationField } from "../contracts";

const reviewUrlLabel = "Fee review URL";
const buttonLabel = "Fee review button label";
export const defaultReviewLabel = "Request a fee review";

export const feeCheckFields: readonly WidgetConfigurationField[] = [
  {
    key: "reviewUrl",
    label: reviewUrlLabel,
    section: "Fee review link",
    control: "url",
    description: "Optional HTTPS destination for visitors who want help reviewing their fees.",
  },
  {
    key: "reviewLabel",
    label: buttonLabel,
    section: "Fee review link",
    control: "text",
    description: `Optional. Defaults to ${defaultReviewLabel}.`,
  },
];

export function parseFeeCheckSettings(input: unknown): WidgetConfiguration {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new WidgetError("Fee check settings must be an object.");
  }

  const value = input as Record<string, unknown>;
  const url = optionalWidgetText(value.reviewUrl, reviewUrlLabel, 2048);
  const label = optionalWidgetText(value.reviewLabel, buttonLabel, 80);
  const settings: WidgetConfiguration = {};
  if (url) settings.reviewUrl = widgetHttpsUrl(url, reviewUrlLabel);
  if (label) settings.reviewLabel = label;
  return settings;
}
