# Widget Console

Widget Console lets an administrator configure widgets, preview them, and publish iframe embeds to approved websites. It runs as one Next.js app with a persistent SQLite database. The dashboard and embeds share one HTTPS hostname. Visitors on approved websites can use embedded widgets without signing in.

## Quick start with Dockhand

You need a Docker host managed by Dockhand and a hostname you can route through Cloudflare Tunnel. In Dockhand, open **Stacks → From Git** and select the Docker environment running your tunnel connector. [Dockhand Git integration](https://dockhand.pro/manual/#git-integration)

| Setting | Value |
| --- | --- |
| Repository URL | `https://github.com/sam-tam-sam/widget-console.git` |
| Branch | `main` |
| Credential | **None (public)** |
| Stack name | `widget-console` |
| Compose file path | [`compose.yaml`](compose.yaml) |
| Build images on deploy | Enabled |

Copy the settings from [`.env.example`](.env.example) into Dockhand's **Environment variables** panel. Set `WIDGET_PUBLIC_ORIGIN` to your HTTPS origin, choose a `WIDGET_ADMIN_USERNAME`, and fill in `WIDGET_ADMIN_PASSWORD` with a unique password of at least 15 characters. Keep the real password in Dockhand.

Deploy the stack and wait for the `app` container to show **Healthy**. The image is built on the Docker host from the configured branch. The runtime image contains the Next.js standalone output and the files it needs to serve requests. [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

### Optional settings

| Variable | Default and purpose |
| --- | --- |
| `WIDGET_HOST_PORT` | `3100` on the Docker host. The app listens on port `3000` inside its container. |
| `WIDGET_BIND_IP` | `127.0.0.1`, which keeps the published port on the Docker host's loopback interface. |
| `WIDGET_VOLUME_NAME` | `widget-console-data`, the named volume for SQLite. |
| `WIDGET_NETWORK_NAME` | `widget-console`, the Docker network the app joins. The app's DNS alias stays `widget-console` even if you rename the network. |
| `WIDGET_TRUST_CLOUDFLARE` | `0`. Use `1` for per-IP sign-in throttling and daily visitor estimates when the app receives requests exclusively through a trusted Cloudflare connector. |

When the app receives a trusted visitor IP, sign-in attempts are limited for that source. The application also limits simultaneous password checks. If the public sign-in page lacks a trusted IP, configure a per-IP rate limit at your proxy for `POST /sign-in` on the app hostname. Keep the iframe challenge exception scoped to the embed path. [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/)

Use an exact HTTPS origin for `WIDGET_PUBLIC_ORIGIN`, such as `https://widgets.example.com`, with no path. The username can contain 3–64 letters, digits, periods, underscores, or hyphens and must start with a letter or digit. Common passwords are rejected.

## Connect Cloudflare Tunnel

1. If `cloudflared` runs in a Docker container on a bridge network, open **Networks → widget-console → Connect container** in Dockhand and select the tunnel connector. Use your custom network name if you set `WIDGET_NETWORK_NAME`. Both containers should appear on that network. [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/#connecting-multiple-compose-projects)
2. In Cloudflare, open **Networking → Tunnels → your tunnel → Routes**. Add or edit a **Published application** for the hostname in `WIDGET_PUBLIC_ORIGIN`. Leave **Path** and **HTTP Host Header** blank so the route covers the app and preserves the public host. [Cloudflare Tunnel routing](https://developers.cloudflare.com/tunnel/concepts/routing/) · [Origin parameters](https://developers.cloudflare.com/tunnel/reference/origin-parameters/#httphostheader)
3. Set **Service URL** based on where the connector runs.

   | Connector setup | Service URL |
   | --- | --- |
   | Docker bridge container on the shared network | `http://widget-console:3000` |
   | Process on the Docker host or container in host network mode | `http://127.0.0.1:3100`, using your `WIDGET_HOST_PORT` if changed |

4. Save the route and open `/sign-in` on your public hostname. Sign in with the credentials you entered in Dockhand.

Inside a bridge container, `localhost` refers to that container. To keep the connection when Docker recreates `cloudflared`, merge the example below into the connector's Compose file. Use your existing connector service name and keep its current networks. The example assumes the connector uses the default network. Deploy Widget Console first so the named network exists, then apply the connector configuration. [External networks in Compose](https://docs.docker.com/compose/how-tos/networking/#use-an-existing-external-network)

```yaml
services:
  cloudflared:
    networks:
      - default
      - widget_console

networks:
  widget_console:
    external: true
    name: widget-console
```

If you set `WIDGET_NETWORK_NAME`, use that value for `networks.widget_console.name` in the connector configuration.

### Allow widget embeds through Cloudflare

If a Cloudflare security rule challenges requests to your app hostname, exempt widget iframe requests before publishing. A Cloudflare challenge page cannot load inside an iframe on another website. [Cloudflare challenge limitations](https://developers.cloudflare.com/cloudflare-challenges/concepts/how-challenges-work/#limitations)

1. In Cloudflare, open **Security → Analytics → Events**. Filter by your app hostname and paths starting with `/embed/`, then open a challenge event to identify the rule. [Security Events](https://developers.cloudflare.com/waf/analytics/security-events/)
2. If the event points to a custom challenge rule, open that rule under **Security rules → Edit expression**. Wrap its existing expression in parentheses and append the condition below. Replace `widgets.example.com` with the hostname in `WIDGET_PUBLIC_ORIGIN`. Keep the rule action so `/sign-in` still receives its existing protection.

   ```text
   and not (
     http.host eq "widgets.example.com"
     and http.request.method eq "GET"
     and starts_with(http.request.uri.path, "/embed/")
     and any(http.request.headers["sec-fetch-dest"][*] eq "iframe")
     and any(http.request.headers["sec-fetch-mode"][*] eq "navigate")
   )
   ```

3. Save the rule and test the embedded widget in a private browser window on a website listed in **Approved origins**. This one-time Cloudflare setting covers future widget links on the same hostname.

### Allow PWA install files through Cloudflare

Browsers need to fetch the public manifest and icons when they install Widget Console. A challenge response contains HTML, so it cannot serve as a manifest or icon. Check **Security Events** for these paths on the app hostname to identify the matching rule. [Cloudflare challenge responses](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)

If a custom challenge rule is responsible, wrap its existing expression in parentheses and append the condition below. Replace `widgets.example.com` with the hostname in `WIDGET_PUBLIC_ORIGIN`. This exception applies only to GET requests for public install files.

```text
and not (
  http.host eq "widgets.example.com"
  and http.request.method eq "GET"
  and http.request.uri.path in {
    "/manifest.webmanifest"
    "/pwa/apple-touch-icon-v2.png"
    "/pwa/favicon-v2.svg"
    "/pwa/icon-192-v2.png"
    "/pwa/icon-512-v2.png"
  }
)
```

After deployment, check that the manifest and icon URLs return HTTP `200` with the expected manifest or image content type in a private browser window. If an existing installation still shows a placeholder icon, remove that installation and install it again from the HTTPS site. On iPhone and iPad, use **Share → Add to Home Screen**. [WebKit Home Screen icons](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/#new-fallback-icon) · [Chrome manifest updates](https://web.dev/articles/manifest-updates)

## Verify and troubleshoot

Run the health check from a shell on the Docker host. Use your configured host port if you changed it.

```sh
curl -i http://127.0.0.1:3100/api/health
```

From Dockhand's **Shell** inside the `app` container, use Node and the container port.

```sh
node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => console.log(r.status, await r.text()))"
```

Both checks should return HTTP `200` with `{"status":"ok"}`. Test the sign-in page separately over the public HTTPS hostname.

| Symptom | What to check |
| --- | --- |
| Cloudflare returns `502 Bad Gateway` | For a bridge connector, verify both containers share the app network and the route points to `http://widget-console:3000`. Check the tunnel logs if the error continues. [Cloudflare Tunnel troubleshooting](https://developers.cloudflare.com/tunnel/troubleshooting/) |
| `/sign-in` returns `404` | Open the HTTPS hostname in `WIDGET_PUBLIC_ORIGIN` and verify that the tunnel preserves the `Host` header. A direct visit to `localhost:3100/sign-in` returns `404` with the standard public hostname configuration. |
| The health check returns `503` | Check the HTTPS origin, administrator variables, and whether the container can write to the SQLite volume. |
| An iframe is blank or says `refused to connect` | Check the widget's exact approved origin, link status, and iframe URL. If Cloudflare challenged the request, follow [Allow widget embeds through Cloudflare](#allow-widget-embeds-through-cloudflare). |

## Manage widgets

1. Choose **New widget**, select a registered template, and save. The new widget opens on its own settings page.
2. Open **Preview** to try the saved widget at **320px**, **390px**, or the full available width. The admin preview works with an empty list of approved origins.
3. Open the widget's **Approved origins** tab, enter one exact HTTPS origin per line, and save. Add `https://example.com` and `https://www.example.com` on separate lines if both hostnames serve the page. An empty saved list blocks public embedding for that widget.
4. Open **Embed links → Create embed link**, then copy the generated iframe markup into a page on an approved website. Verify it on that page.

Each widget generates one embed link. If the widget already has a link, **Create embed link** opens a confirmation. Confirming replaces all existing links for that widget with one new link. Update the embed code on each page that uses it. Links issued by older versions continue to work until you replace or disable them.

Delete a widget from the dashboard list or from its **Settings** tab. Confirming deletion removes the widget and its embed links.

Use **Style** on a supported widget to change its accent and panel background. The outer iframe background stays transparent so the host page shows through. Save to apply the colors to this instance's preview and existing embeds. **Reset colors** restores the template palette when you save.

Use **Size** to set this widget's iframe heights for compact, mobile, and wide containers. The template supplies the defaults. Enter a whole number between 240 and 2400 pixels or clear the field to restore its default. The generated embed stays full width and uses the height for the space available on the host page. Copy the entire embed block again after changing sizes. If the host strips the style block, the iframe uses the wide height.

The dashboard can be installed as **Widget Console** from the install option in a supporting browser. It opens at the dashboard and uses the same sign-in as the browser.

### Embed analytics

Open **Analytics** in the admin navigation for totals across all widgets, or choose a widget to see its own activity and referring sites. Reports show the last 7, 30, or 90 UTC calendar days, including today. New recorded loads update the visible report automatically. A periodic refresh catches up if the live connection is interrupted.

The Widgets list and Embed links tab also update after changes from another admin session. An open confirmation or a pending form can finish before the new data appears.

An embed load is a request for an enabled widget iframe with an approved HTTPS referrer. Previews and requests that omit their referrer are excluded. The count represents loads rather than time on screen or widget interactions. Data starts accumulating after deployment and stays in the existing SQLite volume for up to 90 days. Replacing an embed link keeps the widget's analytics. Deleting a widget removes its analytics.

The analytics counter caps bursts per widget and origin. When Cloudflare supplies a trusted IP, each source has its own limit. Otherwise the app caps unmeasured loads for the widget and origin. Loads above these limits still display the widget. Historical counts keep their original values.

Visitor estimates require `WIDGET_TRUST_CLOUDFLARE=1` and a valid visitor IP supplied by Cloudflare. Enable it only when requests reach the app through your trusted Cloudflare connector. The app derives a different visitor key each UTC day and discards the raw IP and user agent after processing the request. **Estimated visitor-days** adds the daily distinct counts, so a visitor can count on more than one day. Coverage shows the share of recorded loads with a visitor signal. [Cloudflare visitor IP header](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)

### Fee Check

Select **Fee Check** under **New widget**. In **Settings**, add an optional HTTPS **Fee review URL** and a button label for this instance. The link is available from the statement help and results screens, and opens separately without forwarding the visitor's entries.

The widget uses credit card sales and processing fees from one full USD statement period. The count of successful credit card transactions is optional. If provided, the count must be consistent with completed positive USD sales. Effective rates below 1.5% or at least 15% trigger a confirmation of the statement totals. These are review prompts rather than pricing benchmarks. Results show the period's fees, effective rate, and average sale when a count is available. All visitor calculations run in the browser tab. The widget does not use processor pricing or estimate savings.

### Processing Fee Calculator

Select **Processing Fee Calculator** under **New widget**. In the widget's **Settings**, enter the proposed plan's in-person and online percentage rates and per-transaction fees. Enter `0` for a fee the plan does not charge. Monthly and separate in-person debit fees are optional. Each widget instance keeps its own pricing and optional HTTPS **Conversion URL** and button label. The conversion button opens from the results when a URL is saved.

Open **Preview** to try the calculator. It uses US dollars and offers an illustrative flat rate, published US Square and Stripe rates, and manual monthly totals for the other providers. Use **Enter Custom** to compare a processor outside the catalog. Proposed pricing and savings appear once both channel rates and fees are configured. Visitors' inputs stay in the browser.

## Redeploy and maintain data

- Use **Sync from Git** in Dockhand to deploy a new revision. Keep the same SQLite volume to retain settings, approved origins, and embed link IDs. Back up the database before upgrades. [Docker volumes](https://docs.docker.com/engine/storage/volumes/)
- To rotate administrator credentials, edit the values in Dockhand and redeploy. Existing sessions are revoked when the new credentials take effect.
- If the public hostname changes, update `WIDGET_PUBLIC_ORIGIN` and the tunnel route, then replace the iframe markup on pages that use the old hostname. Existing deployments can use `WIDGET_ADMIN_ORIGIN` as a fallback during the upgrade.

## Development checks

Use Node.js 24 and pnpm 11.25.0 for development checks.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium --only-shell
pnpm test:e2e
```

Playwright uses a disposable database and HTTPS origins to exercise administrator sign-in, widget management, preview, origin enforcement, and deletion.

## Adding a template

Give each approved widget its own module under [`src/widgets/`](src/widgets/). Implement the [`WidgetTemplate` contract](src/widgets/contracts.ts) with a stable key, public catalog metadata, configuration validation, and a renderer. Register the template in the [widget registry](src/widgets/registry.ts). Keep the widget's styling and behavior in its own module. Escape values inserted into rendered markup and treat all data rendered in an embed as public.

For interactive widgets, set `clientScript` to a static, reviewed script from the widget module. The platform includes it in the document and permits only its exact hash in the script policy. Pass validated instance settings as escaped data in the rendered HTML.

Use `configurationFields` for template settings and group related fields with `section`. The shared dashboard renders those fields and owns Style, Size, Preview, Approved origins, and Embed links. Use the existing admin form, status, and input components when extending those controls.

To reuse the appearance editor, declare an `appearance` palette on the template and include `widgetAppearanceCss(appearance, configuration)` in the rendered stylesheet. Use the shared `--widget-*` variables in the template's CSS. The dashboard stores color and size overrides with each instance. Reserve `appearance` and `embedHeights` for the platform, and keep the template validator focused on widget-specific settings.

Set `embedHeights` defaults for `compact`, `mobile`, and `wide` based on the template's content. Use the shared sizing module and preview controls when checking those heights. Keep existing widget IDs, embed URLs, and saved settings compatible across updates.

Keep the outer widget canvas transparent in previews and embeds. Use `widgetDocument()` for the shared document styles and apply background colors only to content panels and controls. Check each step at 320px and 390px, and at a wide viewport, to verify that text, fields, and actions fit without horizontal scrolling.

## License

Widget Console is released under the [MIT License](LICENSE). Provider names and logos are third-party marks and remain subject to their owners' rights.
