import { WidgetError } from "@/widgets/contracts";

const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeOrigin(input: string): string {
  if (typeof input !== "string") throw new WidgetError("Enter valid origins.");
  const value = input.trim();
  if (!/^https:\/\/[^/?#@\s\\]+\/?$/i.test(value)) {
    throw new WidgetError("Use an exact HTTPS origin without a path, such as https://example.com.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WidgetError("Enter a valid origin.");
  }

  if (
    !hostnamePattern.test(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/"
  ) {
    throw new WidgetError("Use an exact origin without a path, query, wildcard, or credentials.");
  }

  return url.origin;
}

export function configuredOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(normalizeOrigin(value));
  } catch {
    return null;
  }
}

export function normalizeOrigins(input: readonly string[]): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new WidgetError("Add at least one approved origin.");
  }

  const origins = [...new Set(input.map(normalizeOrigin))];
  if (origins.join(" ").length > 3_072) {
    throw new WidgetError("The approved origins are too long for a single embed link.");
  }

  return origins;
}

export function embedSecurityHeaders(origins: readonly string[], scriptHashes: readonly string[] = []): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src ${scriptHashes.length ? scriptHashes.join(" ") : "'none'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      `frame-ancestors ${origins.length > 0 ? origins.join(" ") : "'none'"}`,
    ].join("; "),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
}
