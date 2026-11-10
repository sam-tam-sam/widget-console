import { isIP } from "node:net";

/** Enable only when untrusted requests reach the app through Cloudflare. */
export function trustedCloudflareIp(headers: Headers): string | undefined {
  if (process.env.WIDGET_TRUST_CLOUDFLARE !== "1") return undefined;

  const ip = headers.get("cf-connecting-ip")?.trim().toLowerCase();
  return ip && isIP(ip) ? ip : undefined;
}
