import { WidgetError } from "./contracts";

export function optionalWidgetText(input: unknown, label: string, max: number): string | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  if (typeof input !== "string") throw new WidgetError(`${label} must be text.`);

  const text = input.trim();
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new WidgetError(`${label} must be ${max} characters or fewer on one line.`);
  }
  return text || undefined;
}

export function widgetHttpsUrl(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (/^https:\/\//i.test(value) && url.protocol === "https:" && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    // Use the same field error for an invalid URL or scheme.
  }
  throw new WidgetError(`${label} must be an HTTPS link without credentials.`);
}
