# Widget Console

Widget Console is an English-language dashboard for registering widget templates, creating instances, and managing their embed links.

## Deploy with Dockhand

In **Stacks → Deploy from Git**, select the Docker environment where the Cloudflare Tunnel connector can reach the app. Use these stack settings.

| Setting | Value |
| --- | --- |
| Repository URL | `https://github.com/sam-tam-sam/widget-console.git` |
| Branch | `main` |
| Credential | **None (public)** |
| Stack name | `widget-console` |
| Compose file path | `compose.yaml` |
| Build images on deploy | Enabled |

Enter the deployment values in Dockhand's **Environment variables** panel. Compose references these variables and passes the app settings to the container. Keep the password in Dockhand. The public repository contains only variable names and Compose defaults. [Dockhand Git integration](https://dockhand.pro/manual/#git-integration)

| Variable | Value |
| --- | --- |
| `WIDGET_ADMIN_USERNAME` | Choose the sign-in username. Use 3–64 letters, digits, periods, underscores or hyphens, starting with a letter or digit. |
| `WIDGET_ADMIN_PASSWORD` | Choose a strong password with at least 15 characters. Common passwords are rejected. |
| `WIDGET_ADMIN_ORIGIN` | Dashboard origin, for example `https://console.example.com` |
| `WIDGET_EMBED_ORIGIN` | Separate public iframe origin, for example `https://widgets.example.com` |
| `WIDGET_HOST_PORT` | Port on the Docker host. Defaults to `3100`. |
| `WIDGET_BIND_IP` | Address on the Docker host. Defaults to `127.0.0.1`. |
| `WIDGET_VOLUME_NAME` | Named Docker volume for SQLite. Defaults to `widget-console-data`. |
| `WIDGET_NETWORK_NAME` | Docker network shared with the connector if needed. Defaults to `widget-console`. |
| `WIDGET_TRUST_CLOUDFLARE` | Defaults to `0`. Set `1` for per-IP sign-in throttling only when all traffic reaching the app comes through a trusted Cloudflare connector. |

For the two origins, enter the scheme and hostname without a path. Deploy the stack and wait for the `app` container to become healthy. Compose keeps SQLite in a named volume. Use the same volume on redeploy to retain widget settings and embed links. To rotate the administrator username or password, change the value in Dockhand and redeploy. Existing sessions are revoked when the new credentials take effect.

### Connect Cloudflare Tunnel

Create two published application routes on the same tunnel. Use the hostnames from `WIDGET_ADMIN_ORIGIN` and `WIDGET_EMBED_ORIGIN`. When `cloudflared` runs on the Docker host, point both routes to `http://127.0.0.1:3100`, substituting your `WIDGET_HOST_PORT` if changed. Leave **HTTP Host Header** unset to preserve each public hostname. The dashboard and iframe routes depend on the original host. [Cloudflare Tunnel routing](https://developers.cloudflare.com/tunnel/concepts/routing/) · [Origin parameters](https://developers.cloudflare.com/tunnel/reference/origin-parameters/)

If `cloudflared` runs in another Docker container on the same host, deploy Widget Console first and attach the connector to `widget-console` as an external network in the connector's Compose stack. Use the value of `WIDGET_NETWORK_NAME` if you changed it. Point both routes to `http://widget-console:3000`. A separate Cloudflare Access policy can protect the dashboard hostname. Keep the iframe hostname available to visitors on approved websites. [Compose networking](https://docs.docker.com/compose/how-tos/networking/)

Open `/sign-in` on the dashboard hostname and sign in with the credentials from Dockhand.

## Manage widgets

1. Choose **New widget**, select a registered template, and save. The new widget opens on its own settings page.
2. Open **Preview** to see the widget with its saved settings.
3. Under **Embed links**, enter the exact HTTPS origin of the website that will display the widget. Save the link and copy its iframe markup to that site. Verify the iframe loads from the approved site.

Use the widget's settings page to delete it. Confirming deletion removes that widget and its embed links.

Use **Settings → Appearance** on a supported widget to change its accent, page background, and panel background. Save to apply the colors to this instance's preview and existing embeds. **Reset colors** restores the template palette when you save.

### Fee Check

Select **Fee Check** under **New widget**. In **Settings**, add an optional HTTPS **Fee review URL** and a button label for this instance. The link is available from the statement help and results screens, and opens separately without forwarding the visitor's entries.

The widget uses credit card sales and processing fees from one full USD statement period. The count of successful credit card transactions is optional. If provided, the count must be consistent with completed positive USD sales. Effective rates below 1.5% or at least 15% trigger a confirmation of the statement totals. These are review prompts rather than pricing benchmarks. Results show the period's fees, effective rate, and average sale when a count is available. All visitor calculations run in the browser tab. The widget does not use processor pricing or estimate savings.

### Processing Fee Calculator

Select **Processing Fee Calculator** under **New widget**. In the widget's **Settings**, enter the proposed plan's in-person and online percentage rates and per-transaction fees. Enter `0` for a fee the plan does not charge. Monthly and separate in-person debit fees are optional. Each widget instance keeps its own pricing and optional HTTPS **Conversion URL** and button label. The conversion button opens from the results when a URL is saved.

Open **Preview** to try the calculator. It uses US dollars and offers an illustrative flat rate, published US Square and Stripe rates, and manual monthly totals for the other providers. Use **Enter Custom** to compare a processor outside the catalog. Proposed pricing and savings appear once both channel rates and fees are configured. Visitors' inputs stay in the browser.

## Checks

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

Give each approved widget its own module under `src/widgets/`. Implement `WidgetTemplate` from `src/widgets/contracts.ts` with a stable key, public catalog metadata, configuration validation, and a renderer. Register the template in `src/widgets/registry.ts`. Keep the widget's styling and behavior in its own module. Escape values inserted into rendered markup and treat all data rendered in an embed as public.

For interactive widgets, set `clientScript` to a static, reviewed script from the widget module. The platform includes it in the document and permits only its exact hash in the script policy. Pass validated instance settings as escaped data in the rendered HTML.

To reuse the appearance editor, declare an `appearance` palette on the template and include `widgetAppearanceCss(appearance, configuration)` in the rendered stylesheet. Use the shared `--widget-*` variables in the template's CSS. The dashboard handles color editing and stores overrides with the instance.
