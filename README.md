# Widget Console

Widget Console lets an administrator configure widgets, preview them, and publish iframe embeds to approved websites. It runs as one Next.js app with a persistent SQLite database. The dashboard and embeds share one HTTPS hostname. Visitors on approved websites can use embedded widgets without signing in.

## Deploy on Hostinger

In hPanel, create a Node.js Web App for `widget.freedomprocessing3.com`. Import `sam-tam-sam/widget-console` from GitHub or upload a ZIP with `package.json` at its root. [Hostinger Node.js deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Branch for GitHub deployment | `codex/hostinger` |
| Node version | `24.x` |
| Root directory | `./` |
| Build and output settings | Default for Next.js. The `build` script uses Webpack. |
| Start command, if requested | `pnpm start` |

Add these values in hPanel under **Environment variables**.

| Variable | Value |
| --- | --- |
| `WIDGET_PUBLIC_ORIGIN` | `https://widget.freedomprocessing3.com` |
| `WIDGET_ADMIN_USERNAME` | Your administrator username, such as `widget-admin`. |
| `WIDGET_ADMIN_PASSWORD` | A unique password of at least 15 characters. |
| `WIDGET_DB_PATH` | The absolute path to a SQLite file in a private writable directory. |
| `WIDGET_TRUST_CLOUDFLARE` | `0` for the default Hostinger deployment. |

Use File Manager to locate the app's directory. Keep the database outside `hbuilds` and `public_html`, which Hostinger replaces on deploy. For example, if the app directory is `/home/<account>/domains/widget.freedomprocessing3.com`, set the database path to `/home/<account>/domains/widget.freedomprocessing3.com/widget-data/widget-console.sqlite` with the actual account name. Use the same path on future deployments. [Hostinger deployment directories](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/#file-structure-after-deployment)

After deploying, sign in at `https://widget.freedomprocessing3.com/sign-in`. Create a test popup, upload an image, and verify the image remains after redeploying. To embed it on the main site, approve `https://freedomprocessing3.com` in **Approved origins** and copy the script from **Embed links**. A fresh SQLite file starts with a new set of widgets and links.

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

In Dockhand's **Environment variables** panel, set `WIDGET_PUBLIC_ORIGIN` to your HTTPS origin, choose a `WIDGET_ADMIN_USERNAME`, and fill in `WIDGET_ADMIN_PASSWORD` with a unique password of at least 15 characters. Keep the real password in Dockhand.

Deploy the stack and wait for the `app` container to show **Healthy**. The image is built on the Docker host from the configured branch. The runtime image contains the Next.js standalone output and the files it needs to serve requests. [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

### Optional settings

| Variable | Default and purpose |
| --- | --- |
| `WIDGET_HOST_PORT` | `3100` on the Docker host. The app listens on port `3000` inside its container. |
| `WIDGET_BIND_IP` | `127.0.0.1`, which keeps the published port on the Docker host's loopback interface. |
| `WIDGET_VOLUME_NAME` | `widget-console-data`, the named volume for SQLite. |
| `WIDGET_NETWORK_NAME` | `widget-console`, the Docker network the app joins. The app's DNS alias stays `widget-console` even if you rename the network. |
| `WIDGET_TRUST_CLOUDFLARE` | `0`. Use `1` for per-IP sign-in and analytics limits, and estimated visitor-days, when the app receives requests exclusively through a trusted Cloudflare connector. |
| `WIDGET_ANALYTICS_PUBLISHER_KEYS` | Empty. Optional JSON object mapping approved HTTPS origins to credentials for [publisher reports](#report-embed-loads-from-a-publisher-server). Automatic embed counting works without this setting. |

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

Head-script widgets also need public GET responses for the loader, the link's configuration, and any uploaded image. If the same custom rule challenges those requests, append this condition with your Widget Console hostname. The configuration and image paths match a single 36-character ID segment so the exception covers future links and replacement images. Widget Console validates the ID, and only approved origins can load a widget's configuration or frame. [Cloudflare expression operators](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/)

```text
and not (
  http.host eq "widgets.example.com"
  and http.request.method eq "GET"
  and (
    http.request.uri.path eq "/widget-embed/v1.js"
    or (
      http.request.uri.path strict wildcard "/api/embed-config/*-*-4*-*-*"
      and len(http.request.uri.path) eq 54
      and not http.request.uri.path strict wildcard "/api/embed-config/*/*"
    )
    or (
      http.request.uri.path strict wildcard "/widget-media/*-*-4*-*-*"
      and len(http.request.uri.path) eq 50
      and not http.request.uri.path strict wildcard "/widget-media/*/*"
    )
  )
)
```

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

Delete a widget from the dashboard list or from its **Settings** tab. Confirming deletion permanently removes the widget and its embed links. Creating another widget does not restore those deleted links; publish the new widget's generated embed code on its host pages.

Use **Style** on a supported widget to change its accent and panel background. The outer iframe background stays transparent so the host page shows through. Save to apply the colors to this instance's preview and existing embeds. **Reset colors** restores the template palette when you save.

Use **Size** to set this widget's iframe heights for compact, mobile, and wide containers. The template supplies the defaults. Enter a whole number between 240 and 2400 pixels or clear the field to restore its default. The generated embed stays full width and uses the height for the space available on the host page. Copy the entire embed block again after changing sizes. If the host strips the style block, the iframe uses the wide height.

The dashboard can be installed as **Widget Console** from the install option in a supporting browser. It opens at the dashboard and uses the same sign-in as the browser.

### Popup

The popup uses **Embed links → Copy head script**. Add the versioned script to the host page's `<head>` or to an HTML element that emits an executable script on the published page. Save that page's exact HTTPS origin in **Approved origins**. Each script uses the ID of the widget's current embed link. Use **Manage link → Disable link** to stop new displays, and **Enable link** to resume with the same ID. Inline widgets use their iframe code.

- **Opening** happens after the configured delay or when a visitor clicks a host element that matches **Host trigger selector**. Use a button such as `<button type="button" id="widget-popup-trigger">Show offer</button>`. Set **Maximum opens per tab session** to a positive whole number. It defaults to one opening for the visitor's browser tab and current link. If session storage is unavailable, the limit applies to the current page. The close button and Escape dismiss the popup and return keyboard focus. The popup counts only after it opens.
- **Popup images** upload as soon as you choose a file in Settings. Use JPEG, PNG, or WebP up to 5 MiB and 20 megapixels. Widget Console checks and processes the image before saving it to the existing SQLite volume. A successful replacement overwrites the previous image and retires its public asset URL. The host popup is available after an image is saved. The whole image links to **Image link URL** when set. **Size** starts from the image dimensions and lets you override the width and height independently for phone, tablet, medium, and desktop. The popup fits the image into the available area without internal scrolling and places its close button above the image's top-right corner. Each profile has a 10–100% **Scale** control.

If the host has a restrictive Content Security Policy, it must allow the Widget Console HTTPS origin in `script-src`, `connect-src`, and `frame-src`. On WordPress, verify the script on the published page. If LiteSpeed rewrites it as `type="litespeed/javascript"`, add the loader's exact URL under **Page Optimization → Tuning → JS Deferred/Delayed Excludes** and verify the published page again. [LiteSpeed JS exclusions](https://docs.litespeedtech.com/lscache/lscwp/pageopt/#js-deferreddelayed-excludes)

### Embed analytics

Open **Analytics** in the admin navigation for totals across all widgets, or choose a widget to see its own activity and referring sites. Reports show the last 7, 30, or 90 UTC calendar days, including today. New recorded loads update the visible report automatically. A periodic refresh catches up if the live connection is interrupted.

The Widgets list and Embed links tab also update after changes from another admin session. An open confirmation or a pending form can finish before the new data appears.

Widgets count loads automatically after their browser code runs inside an approved site's iframe. No publisher key, host-site integration, or change to existing embed links is required. Reloading a page produces a new load. Admin previews, direct navigation, and browser-blocked embeds do not count.

The initial embed request does not increment the counter. The widget acknowledges its load with a signed, single-use receipt valid for five minutes. The acknowledgment uses a hidden frame on the same `/embed/` route, so the documented Cloudflare iframe exception also covers it. Replaying a receipt does not add another load. Acceptance checks the current link and origin permissions. These browser estimates reduce simple request inflation but do not prove that a visitor is human: an automated browser can also load a widget.

Counts are limited to 60 accepted automatic loads per widget, origin, and trusted IP per minute. When a trusted IP is unavailable, the limit is shared by that widget and origin. Estimated visitor-days use daily keyed hashes of trusted IP and user-agent signals; raw IP addresses are not stored in analytics. Sites that omit the referrer appear as **Unknown site**, and are excluded from the **Active sites** count. Repeated visits on the same day may increase loads while leaving the visitor-day estimate unchanged.

The dashboard distinguishes automatic estimates, optional publisher reports, and historical estimates. The load total combines these records. If a publisher also reports a delivery already counted by the browser, that is an additional record; use the automatic estimate subtotal for browser activity. Historical loads were inferred from request headers. Publisher reports contain no visitor identifiers. Analytics stay in the existing SQLite volume for up to 90 days. Replacing an embed link keeps the widget's analytics. Deleting a widget removes its analytics.

#### Report embed loads from a publisher server

This optional integration records server-reported page deliveries. It is not required for the automatic widget counter, and configuring it does not disable browser counting.

1. Generate a separate 32-byte key for each publisher origin with `openssl rand -hex 32`. In Dockhand, set `WIDGET_ANALYTICS_PUBLISHER_KEYS` to a JSON object whose property names are exact HTTPS origins and whose values are the corresponding keys. Use origins without a trailing slash and omit the default HTTPS port. An invalid entry or reused key disables publisher reporting. Save the matching key in each publisher's server configuration. Keep it out of iframe markup, client code, and logs.
2. When the publisher serves a page containing an active embed, send an HTTPS `POST` with no body to `/api/embed-analytics/<embed-link-id>` on the Widget Console host. Use the UUID from the iframe's existing `/embed/<embed-link-id>` URL. The origin must be approved for that link.

   | Header | Value |
   | --- | --- |
   | `Authorization` | `Bearer <publisher-key>`, with the key as 64 lowercase hexadecimal characters. |
   | `X-Widget-Origin` | Exact publisher origin, such as `https://publisher.example.com`. |
   | `X-Widget-Event-Id` | A new UUID v4 for each event. |
   | `X-Widget-Event-Time` | Decimal Unix time in milliseconds, up to five minutes old or 30 seconds ahead. |

3. Treat `204` as success. While the link and approval are active, retrying an accepted event returns `204` without adding another load. For a timeout, `429`, or `503`, retry within the event's validity window using the same ID and timestamp. Each widget and origin can report up to 60 events per minute. A `400` means invalid event metadata, `401` means invalid credentials, and `404` means the link is unavailable for that origin.

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

Playwright uses a disposable database and HTTPS origins to exercise administrator sign-in and stream revocation, widget management, preview, existing embed links, origin enforcement, automatic browser counts and replay protection, optional publisher reports, and deletion.

The popup browser test uses a disposable HTTPS host fixture with the script in its head and a popup button. Run it with `pnpm test:e2e tests/popup.spec.ts` after building.

## Adding a template

Give each approved widget its own module under [`src/widgets/`](src/widgets/). Implement the [`WidgetTemplate` contract](src/widgets/contracts.ts) with a stable key, public catalog metadata, configuration validation, and a renderer. Register the template in the [widget registry](src/widgets/registry.ts). Keep the widget's styling and behavior in its own module. Escape values inserted into rendered markup and treat all data rendered in an embed as public.

For interactive widgets, set `clientScript` to a static, reviewed script from the widget module. The platform includes it in the document and permits only its exact hash in the script policy. Pass validated instance settings as escaped data in the rendered HTML.

Use `configurationFields` for template settings and group related fields with `section`. The shared dashboard renders those fields and owns Style, Size, Preview, Approved origins, and Embed links. Use the existing admin form, status, and input components when extending those controls.

To reuse the appearance editor, declare an `appearance` palette on the template and include `widgetAppearanceCss(appearance, configuration)` in the rendered stylesheet. Use the shared `--widget-*` variables in the template's CSS. The dashboard stores color and size overrides with each instance. Reserve `appearance` and `embedHeights` for the platform, and keep the template validator focused on widget-specific settings.

Set `embedHeights` defaults for `compact`, `mobile`, and `wide` based on the template's content. Use the shared sizing module and preview controls when checking those heights. Keep existing widget IDs, embed URLs, and saved settings compatible across updates.

Keep the outer widget canvas transparent in previews and embeds. Use `widgetDocument()` for the shared document styles and apply background colors only to content panels and controls. Check each step at 320px and 390px, and at a wide viewport, to verify that text, fields, and actions fit without horizontal scrolling.

## License

Widget Console is released under the [MIT License](LICENSE). Provider names and logos are third-party marks and remain subject to their owners' rights.
