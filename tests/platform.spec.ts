import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { pwaIcons } from "../src/lib/pwa-icons";
import { adminOrigin, approvedOrigin, backendOrigin, otherOrigin, startPlatform } from "./platform-server";

const iframeNavigation = { "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate" };

async function analyticsAt(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, cacheControl: response.headers.get("cache-control"), data: await response.json() };
  }, path);
}

function waitForLiveStream(page: Page, topic: "analytics" | "widgets") {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/admin/live" && url.searchParams.get("topic") === topic;
  }, { timeout: 8_000 });
}

function requestAt(context: BrowserContext, url: string, headers?: Record<string, string>) {
  const address = new URL(url);
  return context.request.get(backendOrigin + address.pathname + address.search, {
    headers: { Host: address.host, "X-Forwarded-Host": address.host, "X-Forwarded-Proto": "https", ...headers },
    maxRedirects: 0,
  });
}

function reportEmbedLoad(context: BrowserContext, id: string, {
  origin,
  key,
  eventId = randomUUID(),
  eventTime = Date.now(),
}: { origin: string; key?: string; eventId?: string; eventTime?: number }) {
  const host = new URL(adminOrigin).host;
  return context.request.post(`${backendOrigin}/api/embed-analytics/${id}`, {
    headers: {
      Host: host,
      "X-Forwarded-Host": host,
      "X-Forwarded-Proto": "https",
      "X-Widget-Origin": origin,
      "X-Widget-Event-Id": eventId,
      "X-Widget-Event-Time": String(eventTime),
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    maxRedirects: 0,
  });
}

async function signIn(page: Page, username: string, password: string) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function createWidget(page: Page, template: string, name: string) {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Widgets", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "New widget", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/widgets\/new$/);
  await page.getByLabel("Template", { exact: true }).selectOption(template);
  await page.getByLabel("Widget name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create widget", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/widgets\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  const path = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=preview$/);
  return path;
}

async function saveApprovedOrigins(page: Page, ...origins: string[]) {
  await page.getByRole("navigation", { name: "Widget sections" }).getByRole("link", { name: "Approved origins", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=origins$/);
  await page.getByRole("textbox", { name: "Approved origins", exact: true }).fill(origins.join("\n"));
  const save = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === page.url());
  await page.getByRole("button", { name: "Save approved origins", exact: true }).click();
  expect((await save).ok()).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Approved origins saved." })).toBeVisible();
}

async function expectAlignedFields(page: Page, ...labels: string[]) {
  const boxes = await Promise.all(labels.map((name) =>
    page.getByLabel(name, { exact: true }).evaluate((field) => {
      const { top, width, height } = field.getBoundingClientRect();
      return { top: Math.round(top), width: Math.round(width), height: Math.round(height) };
    }),
  ));
  for (const box of boxes.slice(1)) expect(box).toEqual(boxes[0]);
}

async function currentLink(page: Page) {
  const row = page.locator("[data-link-id]");
  await expect(row).toHaveCount(1);
  const id = await row.getAttribute("data-link-id");
  if (!id) throw new Error("The new embed link has no ID.");
  return { id, row: page.locator(`[data-link-id="${id}"]`) };
}

async function createLink(page: Page) {
  await expect(page.locator("[data-link-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "Create embed link", exact: true }).click();
  return currentLink(page);
}

async function embedPolicy(context: BrowserContext, id: string) {
  const response = await requestAt(context, `${adminOrigin}/embed/${id}`, iframeNavigation);
  expect(response.status()).toBe(200);
  return response.headers()["content-security-policy"];
}

async function expectFrameBlocked(host: Page, origin: string, linkId: string) {
  const violation = host.waitForEvent("console", {
    predicate: (entry) => entry.text().includes("frame-ancestors"),
    timeout: 5000,
  });
  await host.goto(`${origin}/${linkId}`);
  await violation;
}

test("runtime credentials, widget settings, and production embed management", async ({ page, browser }, testInfo) => {
  const initial = { username: "widget-test-owner", password: randomBytes(24).toString("base64url") };
  const rotated = { username: "widget-test-rotated", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(initial, { historicalViews: 3 });
  const visitor = await browser.newContext({ baseURL: adminOrigin, ignoreHTTPSErrors: true });
  try {
    await test.step("protect the dashboard and sign in with runtime credentials", async () => {
      expect((await requestAt(visitor, "https://unexpected.localhost/admin")).status()).toBe(404);
      expect((await visitor.request.get(`${backendOrigin}/admin`)).status()).toBe(404);
      expect((await requestAt(visitor, `${adminOrigin}/api/health`)).status()).toBe(404);
      const protectedDashboard = await requestAt(visitor, `${adminOrigin}/admin`);
      expect(protectedDashboard.headers().location).toMatch(/\/sign-in$/);
      expect(protectedDashboard.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(protectedDashboard.headers()["content-security-policy"]).toContain("form-action 'self'");
      expect(protectedDashboard.headers()["referrer-policy"]).toBe("same-origin");
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/sign-in$/);
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
      const manifestResponse = await requestAt(visitor, `${adminOrigin}/manifest.webmanifest`);
      expect(manifestResponse.status()).toBe(200);
      expect(manifestResponse.headers()["cache-control"]).toContain("no-store");
      const manifest: { icons: { src: string; sizes: string; purpose?: string }[] } = await manifestResponse.json();
      expect(manifest).toMatchObject({
        id: "/admin", name: "Widget Console", start_url: "/admin", scope: "/", display: "standalone",
        icons: expect.arrayContaining([
          expect.objectContaining({ sizes: "192x192", purpose: "any" }),
          expect.objectContaining({ sizes: "512x512", purpose: "any" }),
          expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
        ]),
      });
      const appleIcon = page.locator('link[rel="apple-touch-icon"]');
      await expect(appleIcon).toHaveAttribute("href", pwaIcons.apple);
      const icons = new Map([
        ...manifest.icons.map(({ src, sizes }) => [src, sizes] as const),
        [pwaIcons.apple, "180x180"],
      ]);
      for (const [path, sizes] of icons) {
        const icon = await requestAt(visitor, new URL(path, adminOrigin).href);
        expect(icon.status()).toBe(200);
        expect(icon.headers()["content-type"]).toContain("image/png");
        expect(icon.headers()["cache-control"]).toContain("immutable");
        const body = await icon.body();
        expect(`${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`).toBe(sizes);
      }
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", pwaIcons.favicon);
      for (const path of ["/icon1.png", "/icon2.png", "/apple-icon.png", "/icon.svg"]) {
        expect((await requestAt(visitor, `${adminOrigin}${path}`)).status()).toBe(200);
      }
      await signIn(page, "admin", "123456");
      await expect(page.getByText("The username or password is incorrect.")).toBeVisible();
      await signIn(page, initial.username, initial.password);
      await expect(page).toHaveURL(/\/admin$/);
      expect(await page.context().cookies(adminOrigin)).toContainEqual(expect.objectContaining({
        name: "widget_admin_session", secure: true, httpOnly: true,
      }));
      expect(await page.context().cookies(approvedOrigin)).not.toContainEqual(expect.objectContaining({ name: "widget_admin_session" }));
    });

    await test.step("revoke prior sessions when runtime credentials change", async () => {
      await platform.restart(initial);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin$/);
      await platform.restart(rotated);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/sign-in$/);
      await signIn(page, initial.username, initial.password);
      await expect(page.getByText("The username or password is incorrect.")).toBeVisible();
      await signIn(page, rotated.username, rotated.password);
      await expect(page).toHaveURL(/\/admin$/);
    });

    await test.step("preserve old link permissions until the widget list is explicitly saved", async () => {
      const { widgetId, links } = platform.legacy;
      for (const { id, origin } of links) {
        expect(await embedPolicy(visitor, id)).toContain(`frame-ancestors ${origin}`);
      }
      const legacyHost = await visitor.newPage();
      const receipt = legacyHost.waitForResponse((response) => new URL(response.url()).searchParams.has("view"));
      await legacyHost.goto(`${links[0].origin}/${links[0].id}`);
      await expect(legacyHost.frameLocator("iframe").locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      expect((await receipt).status()).toBe(204);
      await legacyHost.close();
      const analytics = await analyticsAt(page, `/api/admin/widget-analytics?widgetId=${widgetId}`);
      expect(analytics.data).toMatchObject({ views: 4, browserViews: 1, publisherViews: 0, visitorDays: null, measuredViews: 0 });

      await page.goto(`/admin/widgets/${widgetId}`);
      await page.getByLabel("Widget name", { exact: true }).fill("Legacy widget renamed");
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /settings saved/i })).toBeVisible();
      for (const { id, origin } of links) {
        expect(await embedPolicy(visitor, id)).toContain(`frame-ancestors ${origin}`);
      }

      await saveApprovedOrigins(page, otherOrigin);
      const db = new DatabaseSync(platform.database, { readOnly: true });
      try {
        const storedOrigin = db.prepare("SELECT origins_json FROM widget_embed_links WHERE id = ?");
        for (const { id } of links) {
          expect(await embedPolicy(visitor, id)).toContain(`frame-ancestors ${otherOrigin}`);
          expect(storedOrigin.get(id)).toMatchObject({ origins_json: JSON.stringify([otherOrigin]) });
        }
      } finally {
        db.close();
      }

      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await currentLink(page);
      await page.getByRole("button", { name: "Create embed link", exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: /Replace embed link/ });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Replace link", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Embed link replaced." })).toBeVisible();
      const replacement = await currentLink(page);
      for (const { id } of links) {
        expect(replacement.id).not.toBe(id);
        expect((await requestAt(visitor, `${adminOrigin}/embed/${id}`, iframeNavigation)).status()).toBe(404);
      }
      expect(await embedPolicy(visitor, replacement.id)).toContain(`frame-ancestors ${otherOrigin}`);
    });

    await test.step("create, preview, publish, and remove widgets independently", async () => {
      const noticePath = await createWidget(page, "freedom-fee-check", "Site notice");
      await expect(page.frameLocator('iframe[title="Widget preview"]').getByRole("heading", { name: "Fee Check" })).toBeVisible();
      const privatePreview = await requestAt(visitor, `${adminOrigin}${noticePath}?tab=preview`);
      expect(privatePreview.headers().location).toMatch(/\/sign-in$/);
      await createWidget(page, "processing-fee-calculator", "Site details");
      const detailsPreview = page.frameLocator('iframe[title="Widget preview"]');
      await expect(detailsPreview.getByRole("button", { name: "Calculate savings" })).toBeVisible();
      await saveApprovedOrigins(page, approvedOrigin);
      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=links$/);
      const details = await createLink(page);

      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Widgets", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open Site details", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open Site notice", exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Open Site notice", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Site notice", exact: true })).toBeVisible();
      await expect(page.getByLabel("Widget name", { exact: true })).toHaveValue("Site notice");
      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=links$/);
      await expect(page.locator("[data-link-id]")).toHaveCount(0);

      const first = await createLink(page);
      const embedURL = `${adminOrigin}/embed/${first.id}`;
      await first.row.getByText("View iframe code", { exact: true }).click();
      await expect(first.row.getByLabel("Embed code")).toHaveValue(new RegExp(embedURL));
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await first.row.getByRole("button", { name: "Copy embed code" }).click();
      await expect(first.row.getByRole("status")).toHaveText("Copied");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(embedURL);

      await expect(page.getByRole("button", { name: "Use local test site", exact: true })).toHaveCount(0);
      await expect(first.row.getByRole("button", { name: "Test locally", exact: true })).toHaveCount(0);

      const host = await visitor.newPage();
      const direct = await host.goto(embedURL);
      expect(direct?.status()).toBe(403);
      const emptyPolicy = await embedPolicy(visitor, first.id);
      expect(emptyPolicy).toContain("frame-ancestors 'none'");
      expect(emptyPolicy).toContain("sandbox allow-scripts");
      expect(emptyPolicy).not.toContain("allow-same-origin");
      expect(emptyPolicy).toContain("connect-src 'none'");
      await expectFrameBlocked(host, approvedOrigin, first.id);

      await page.locator(".console-tab-content").getByRole("link", { name: "Approved origins", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=origins$/);
      await saveApprovedOrigins(page, approvedOrigin);
      await host.goto(`${approvedOrigin}/${first.id}`);
      const embeddedWidget = host.frameLocator("iframe").getByRole("heading", { name: "Fee Check" });
      await expect(embeddedWidget).toBeVisible();
      expect(await embeddedWidget.evaluate((node) => node.ownerDocument.defaultView?.origin)).toBe("null");

      await page.getByRole("link", { name: "Size", exact: true }).click();
      const compactHeight = page.getByLabel("320px height", { exact: true });
      const mobileHeight = page.getByLabel("390px height", { exact: true });
      await expectAlignedFields(page, "320px height", "390px height", "Wide height");
      await expect(compactHeight).toHaveAttribute("placeholder", "820");
      await expect(mobileHeight).toHaveAttribute("placeholder", "780");
      await compactHeight.evaluate((input) => input.closest("form")?.setAttribute("novalidate", ""));
      await compactHeight.fill("1");
      await page.getByRole("button", { name: "Save sizes", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "whole number from 240 to 2400" })).toBeVisible();
      await compactHeight.fill("900");
      await mobileHeight.fill("800");
      await page.getByRole("button", { name: "Save sizes", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Embed sizes saved." })).toBeVisible();
      await page.reload();
      await expect(compactHeight).toHaveValue("900");
      await expect(mobileHeight).toHaveValue("800");

      await page.getByRole("link", { name: "Preview", exact: true }).click();
      const previewFrame = page.locator('iframe[title="Widget preview"]');
      await page.getByRole("button", { name: "320px", exact: true }).click();
      await expect(previewFrame).toHaveCSS("width", "320px");
      await expect(previewFrame).toHaveCSS("height", "900px");
      await page.getByRole("button", { name: "390px", exact: true }).click();
      await expect(previewFrame).toHaveCSS("width", "390px");
      await expect(previewFrame).toHaveCSS("height", "800px");

      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await first.row.getByText("View iframe code", { exact: true }).click();
      const updatedMarkup = await first.row.getByLabel("Embed code").inputValue();
      expect(updatedMarkup).toContain(embedURL);
      await host.evaluate((markup) => { document.body.innerHTML = `<main>${markup}</main>`; }, updatedMarkup);
      await expect(embeddedWidget).toBeVisible();
      for (const [width, height] of [[320, 900], [390, 800], [720, 780]]) {
        await host.locator("main").evaluate((main, value) => { main.style.width = `${value}px`; }, width);
        await expect(host.locator("iframe")).toHaveCSS("height", `${height}px`);
      }
      await page.getByRole("link", { name: "Size", exact: true }).click();
      await compactHeight.fill("");
      await page.getByRole("button", { name: "Save sizes", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Embed sizes saved." })).toBeVisible();
      await page.reload();
      await expect(compactHeight).toHaveValue("");
      await expect(mobileHeight).toHaveValue("800");
      await expectFrameBlocked(host, otherOrigin, first.id);

      await host.goto(`${approvedOrigin}/${details.id}`);
      await expect(host.frameLocator("iframe").getByRole("button", { name: "Calculate savings" })).toBeVisible();

      await saveApprovedOrigins(page, otherOrigin);
      expect(await embedPolicy(visitor, first.id)).toContain(`frame-ancestors ${otherOrigin}`);
      expect(await embedPolicy(visitor, details.id)).toContain(`frame-ancestors ${approvedOrigin}`);
      await expectFrameBlocked(host, approvedOrigin, first.id);

      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await first.row.getByText("View iframe code", { exact: true }).click();
      await expect(first.row.getByLabel("Embed code")).toHaveValue(new RegExp(embedURL));

      const createButton = page.getByRole("button", { name: "Create embed link", exact: true });
      await createButton.click();
      const replaceConfirmation = page.getByRole("dialog", { name: /Replace embed link/ });
      const cancelReplacement = replaceConfirmation.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancelReplacement).toBeFocused();
      await cancelReplacement.click();
      await expect(replaceConfirmation).toHaveCount(0);
      await expect(createButton).toBeFocused();
      expect((await currentLink(page)).id).toBe(first.id);
      await host.goto(`${otherOrigin}/${first.id}`);
      await expect(embeddedWidget).toBeVisible();

      const staleTab = await page.context().newPage();
      await staleTab.goto(page.url());
      await staleTab.getByRole("button", { name: "Create embed link", exact: true }).click();
      const staleConfirmation = staleTab.getByRole("dialog", { name: /Replace embed link/ });
      await expect(staleConfirmation).toBeVisible();

      await createButton.click();
      await replaceConfirmation.getByRole("button", { name: "Replace link", exact: true }).click();
      await expect(replaceConfirmation).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Embed link replaced." })).toBeVisible();
      const replacement = await currentLink(page);
      expect(replacement.id).not.toBe(first.id);
      expect((await requestAt(visitor, embedURL, iframeNavigation)).status()).toBe(404);
      await host.goto(`${otherOrigin}/${replacement.id}`);
      await expect(embeddedWidget).toBeVisible();
      expect(await embedPolicy(visitor, details.id)).toContain(`frame-ancestors ${approvedOrigin}`);
      await staleConfirmation.getByRole("button", { name: "Replace link", exact: true }).click();
      await expect(staleConfirmation.getByRole("alert")).toHaveText("The embed link changed. Reload this page and try again.");
      await staleTab.close();
      expect(await embedPolicy(visitor, replacement.id)).toContain(`frame-ancestors ${otherOrigin}`);

      await replacement.row.getByText("Manage link", { exact: true }).click();
      await replacement.row.getByText("Disable link", { exact: true }).click();
      await replacement.row.getByRole("button", { name: "Confirm disable", exact: true }).click();
      await expect(replacement.row.getByText("Disabled", { exact: true })).toBeVisible();
      const replacementURL = `${adminOrigin}/embed/${replacement.id}`;
      expect((await requestAt(visitor, replacementURL, iframeNavigation)).status()).toBe(404);
      await replacement.row.getByRole("button", { name: "Enable link", exact: true }).click();
      await expect(replacement.row.getByText("Enabled", { exact: true })).toBeVisible();

      await saveApprovedOrigins(page);
      expect(await embedPolicy(visitor, replacement.id)).toContain("frame-ancestors 'none'");
      await page.goto("/admin");
      const deleteButton = page.getByRole("button", { name: "Delete widget Site notice", exact: true });
      await deleteButton.click();
      const confirmation = page.getByRole("dialog", { name: "Delete widget?" });
      await expect(confirmation).toBeVisible();
      await expect(confirmation).toContainText("embed link will stop working.");
      const cancel = confirmation.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeFocused();
      await cancel.click();
      await expect(confirmation).toBeHidden();
      await expect(deleteButton).toBeFocused();
      await expect(page.getByRole("link", { name: "Open Site notice", exact: true })).toBeVisible();
      await deleteButton.click();
      await confirmation.getByRole("button", { name: "Delete widget", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\?deleted=1$/);
      await expect(page.getByText("Widget deleted.", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open Site notice", exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Open Site details", exact: true })).toBeVisible();
      expect((await requestAt(visitor, replacementURL, iframeNavigation)).status()).toBe(404);
      expect((await page.goto(noticePath))?.status()).toBe(404);
      await host.goto(`${approvedOrigin}/${details.id}`);
      await expect(host.frameLocator("iframe").getByRole("button", { name: "Calculate savings" })).toBeVisible();
      await page.goto("/admin");
      await page.getByRole("link", { name: "Open Site details", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Site details", exact: true })).toBeVisible();

      await page.goto("/admin");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await page.locator(".console-sidebar").evaluate((sidebar) => sidebar.clientHeight)).toBeLessThan(160);
        const navigation = page.getByRole("navigation", { name: "Admin navigation" });
        await expect(navigation).toHaveCSS("position", "fixed");
        await expect(navigation.getByRole("link", { name: "Widgets", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(navigation.getByRole("link", { name: "Analytics", exact: true })).toBeInViewport();
        await expect(page.getByRole("link", { name: "New widget", exact: true })).toBeInViewport();
        await expect(page.getByRole("button", { name: "Delete widget Site details", exact: true })).toBeInViewport();
      }
      await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 320, height: 844 });
      await page.getByRole("link", { name: "Open Site details", exact: true }).click();
      const sections = page.getByRole("navigation", { name: "Widget sections" });
      await expect(sections.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("aria-current", "page");
      for (const name of ["Settings", "Style", "Size", "Preview", "Embed links", "Approved origins"]) {
        const section = sections.getByRole("link", { name, exact: true });
        await expect(section).toBeInViewport({ ratio: 1 });
        expect(await section.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await page.screenshot({ path: testInfo.outputPath("widget-settings-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await host.close();
    });

    await test.step("configure and verify the processing fee calculator", async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await createWidget(page, "processing-fee-calculator", "Fee comparison");
      const preview = page.frameLocator('iframe[title="Widget preview"]');
      await preview.getByRole("button", { name: "Calculate savings", exact: true }).click();
      await expect(preview.locator("#result-current-cost")).toHaveText("$3,325.00");
      await expect(preview.locator("#result-plan-missing")).toBeVisible();
      await expect(preview.locator("#result-projection")).toBeHidden();

      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByLabel("Proposed plan name", { exact: true }).fill("Test plan");
      await page.getByLabel("In-person rate (%)", { exact: true }).fill("2");
      await page.getByLabel("In-person fee per transaction ($)", { exact: true }).fill("0.10");
      await page.getByLabel("Online rate (%)", { exact: true }).fill("2.5");
      await page.getByLabel("Online fee per transaction ($)", { exact: true }).fill("0.20");
      await page.getByLabel("Monthly plan fee ($)", { exact: true }).fill("20");
      const destination = "https://example.com/request-a-quote";
      await expectAlignedFields(page, "Conversion URL", "Conversion button label");
      await page.getByLabel("Conversion URL", { exact: true }).fill(destination);
      await page.getByLabel("Conversion button label", { exact: true }).fill("Request my quote");
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
      await saveApprovedOrigins(page, approvedOrigin);
      await page.getByRole("link", { name: "Style", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=style$/);
      await page.getByLabel("Accent color", { exact: true }).fill("#193a71");
      await page.getByRole("button", { name: "Save style", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=links$/);
      const calculatorLink = await createLink(page);

      const host = await visitor.newPage();
      await host.setViewportSize({ width: 1092, height: 1000 });
      const embeddedUrl = `${approvedOrigin}/${calculatorLink.id}`;
      const widgetErrors: string[] = [];
      host.on("pageerror", (error) => widgetErrors.push(error.message));
      host.on("console", (entry) => {
        if (entry.type() === "error") widgetErrors.push(entry.text());
      });
      await host.goto(embeddedUrl);
      const calculator = host.frameLocator('iframe[title="Embedded fixture"]');
      await expect(calculator.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(calculator.locator("#calculate-button")).toHaveCSS("background-color", "rgb(25, 58, 113)");
      const square = calculator.getByRole("button", { name: "Square", exact: true });
      const logo = square.locator("img");
      await expect(logo).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
      await expect.poll(() =>
        logo.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
      ).toBe(true);
      const thumbnails = calculator.locator('.fee-provider-grid:not([hidden]) img');
      await expect(thumbnails).toHaveCount(18);
      await expect.poll(() => thumbnails.evaluateAll((images) => images.every((image) =>
        image instanceof HTMLImageElement && image.src.startsWith("data:image/") && image.complete && image.naturalWidth > 0,
      ))).toBe(true);
      await host.screenshot({ path: testInfo.outputPath("calculator-desktop.png") });

      await square.click();
      await calculator.getByRole("button", { name: "Calculate savings", exact: true }).click();
      await expect(calculator.locator("#result-current-cost")).toHaveText("$2,237.50");
      await expect(calculator.locator("#result-proposed-cost")).toHaveText("$1,645.00");
      await expect(calculator.locator("#result-monthly-difference")).toHaveText("+$592.50");
      await expect(calculator.locator("#result-annual-difference")).toHaveText("+$7,110.00");
      const conversionLink = calculator.getByRole("link", { name: "Request my quote", exact: true });
      await expect(conversionLink).toHaveAttribute("href", destination);
      await expect(conversionLink).toHaveAttribute("target", "_blank");
      await visitor.route(destination, (route) => route.fulfill({ body: "Quote page" }));
      const openingQuote = visitor.waitForEvent("page");
      await conversionLink.click();
      const quote = await openingQuote;
      await expect(quote).toHaveURL(destination);
      await quote.close();

      await host.goto(embeddedUrl);
      await calculator.getByRole("button", { name: "Enter Custom", exact: true }).click();
      const dialog = calculator.getByRole("dialog", { name: "Your Current Monthly Costs" });
      await dialog.getByLabel("Name of Provider", { exact: true }).fill("My current provider");
      await dialog.locator("#monthly-cost").fill("133");
      await expect(dialog.locator("#cost-warning")).toContainText("below 1.5%");
      await host.screenshot({ path: testInfo.outputPath("calculator-dialog.png") });
      await dialog.getByRole("button", { name: "Set Costs", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await calculator.getByRole("button", { name: "Calculate savings", exact: true }).click();
      await expect(calculator.locator("#result-current-cost")).toHaveText("$133.00");
      await expect(calculator.locator("#result-current-effective")).toHaveText(/^0\.27%/);
      await expect(calculator.locator("#result-monthly-difference")).toHaveText("-$1,512.00");

      await host.setViewportSize({ width: 390, height: 900 });
      await host.goto(embeddedUrl);
      const mobile = calculator.locator("#processing-fee-calculator");
      await expect(mobile).toBeVisible();
      expect(await mobile.evaluate((node) => node.ownerDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const mobileHeight = await mobile.evaluate((node) => node.scrollHeight);
      await host.locator('iframe[title="Embedded fixture"]').evaluate((node, height) => {
        if (node instanceof HTMLIFrameElement) node.style.height = `${height}px`;
      }, mobileHeight);
      await host.screenshot({ path: testInfo.outputPath("calculator-mobile.png"), fullPage: true });
      expect(widgetErrors).toEqual([]);
    });

    await test.step("check statement fees through the protected, customizable widget", async () => {
      const widgetPath = await createWidget(page, "freedom-fee-check", "Freedom Fee Check");
      const preview = page.frameLocator('iframe[title="Widget preview"]');
      await expect(preview.locator('[data-panel="statement"]')).toBeVisible();
      await preview.locator('[data-action="statement-yes"]').click();
      await expect(preview.locator('[data-panel="sales"]')).toBeVisible();
      const privatePreview = await requestAt(visitor, `${adminOrigin}${widgetPath}?tab=preview`);
      expect(privatePreview.headers().location).toMatch(/\/sign-in$/);

      const destination = "https://example.com/fee-review";
      const actionLabel = "Ask for a fee review";
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByLabel("Fee review URL", { exact: true }).fill(destination);
      await page.getByLabel("Fee review button label", { exact: true }).fill(actionLabel);
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
      await saveApprovedOrigins(page, approvedOrigin);
      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=links$/);
      const link = await createLink(page);
      const embedURL = `${adminOrigin}/embed/${link.id}`;
      const embeddedURL = `${approvedOrigin}/${link.id}`;

      const styleTab = page.getByRole("link", { name: "Style", exact: true });
      await styleTab.click();
      await expect(styleTab).toHaveAttribute("aria-current", "page");
      const accent = page.getByLabel("Accent color", { exact: true });
      const surface = page.getByLabel("Panel background", { exact: true });
      await expect(page.getByLabel("Page background", { exact: true })).toHaveCount(0);
      await expect(accent).toHaveValue("#4a2170");
      await page.getByLabel("Pick accent color", { exact: true }).fill("#0f766e");
      await expect(accent).toHaveValue("#0f766e");
      await page.getByRole("button", { name: "Reset colors", exact: true }).click();
      await expect(accent).toHaveValue("#4a2170");
      await accent.fill("#0f766e");
      await surface.fill("#effaf5");
      await page.getByRole("button", { name: "Save style", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
      await page.reload();
      await expect(accent).toHaveValue("#0f766e");
      await expect(surface).toHaveValue("#effaf5");
      await page.getByRole("link", { name: "Preview", exact: true }).click();
      await expect(preview.locator(".fee-check-rail")).toHaveCSS("background-color", "rgb(15, 118, 110)");
      await expect(preview.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

      await createWidget(page, "freedom-fee-check", "Another fee check");
      await expect(preview.locator(".fee-check-rail")).toHaveCSS("background-color", "rgb(74, 33, 112)");

      const host = await visitor.newPage();
      const direct = await host.goto(embedURL);
      expect(direct?.status()).toBe(403);
      const violation = host.waitForEvent("console", {
        predicate: (entry) => entry.text().includes("frame-ancestors"),
        timeout: 5000,
      });
      await host.goto(`${otherOrigin}/${link.id}`);
      await violation;

      const widgetErrors: string[] = [];
      host.on("pageerror", (error) => widgetErrors.push(error.message));
      host.on("console", (entry) => {
        if (entry.type() === "error") widgetErrors.push(entry.text());
      });
      await host.setViewportSize({ width: 1100, height: 850 });
      await host.goto(embeddedURL);
      const frame = host.frameLocator('iframe[title="Embedded fixture"]');
      const statement = frame.locator('[data-panel="statement"]');
      const help = frame.locator('[data-panel="help"]');
      const sales = frame.locator('[data-panel="sales"]');
      const fees = frame.locator('[data-panel="fees"]');
      const result = frame.locator('[data-panel="result"]');
      const widget = frame.locator("#freedom-fee-check");
      await expect(statement).toBeVisible();
      expect(await widget.evaluate((node) => node.ownerDocument.title)).toBe("Fee Check");
      await expect(frame.getByRole("heading", { name: "Fee Check", exact: true })).toBeVisible();
      await expect(frame.locator("body")).not.toContainText(/Freedom/i, { useInnerText: true });
      await expect(frame.locator(".fee-check-rail")).toHaveCSS("background-color", "rgb(15, 118, 110)");
      await expect(frame.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(frame.locator(".fee-check-paper")).toHaveCSS("background-color", "rgb(239, 250, 245)");
      expect(await widget.evaluate((node) => node.ownerDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
      await host.screenshot({ path: testInfo.outputPath("fee-check-start.png") });

      await statement.locator('[data-action="statement-no"]').click();
      await expect(help).toBeVisible();
      await expect(help.getByRole("link", { name: actionLabel, exact: true })).toHaveAttribute("href", destination);
      await expect(result).toBeHidden();
      await help.locator('[data-action="back"]').click();
      await expect(statement).toBeVisible();

      await statement.locator('[data-action="statement-yes"]').click();
      await expect(sales.locator("[data-panel-heading]")).toBeFocused();
      const salesInput = sales.locator("#fee-check-sales");
      const countInput = sales.getByLabel("Successful credit card transactions (optional)", { exact: true });
      await expect(sales.getByText("Use the count from the same statement period.", { exact: true })).toBeVisible();
      await salesInput.fill("50");
      await countInput.fill("6250");
      await sales.locator("#fee-check-sales-next").click();
      await expect(sales.locator("#fee-check-count-error")).toBeVisible();
      await expect(countInput).toBeFocused();
      await expect(fees).toBeHidden();
      await expect(result).toBeHidden();

      await countInput.clear();
      await sales.locator("#fee-check-sales-next").click();
      const feeInput = fees.locator("#fee-check-fees");
      await feeInput.fill("32");
      await fees.locator("#fee-check-show-result").click();
      await expect(fees.locator("#fee-check-warning")).toBeVisible();
      await expect(result).toBeHidden();
      await host.screenshot({ path: testInfo.outputPath("fee-check-warning.png") });

      await host.setViewportSize({ width: 320, height: 740 });
      expect(await widget.evaluate((node) => node.ownerDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await expect(fees.locator("#fee-check-confirm")).toBeVisible();
      await fees.locator("#fee-check-confirm").click();
      await expect(result.locator("#fee-check-result-rate")).toHaveText("64%");
      await expect(result.locator("#fee-check-result-sales")).toHaveText("$50.00");
      await expect(result.locator("#fee-check-result-fees")).toHaveText("$32.00");
      await expect(result.locator("#fee-check-average-row")).toBeHidden();

      await host.setViewportSize({ width: 768, height: 900 });
      expect(await widget.evaluate((node) => node.ownerDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(768);

      await result.locator('[data-action="back"]').click();
      await expect(feeInput).toHaveValue(/^(?:\$\s*)?32(?:\.00)?$/);
      await fees.locator('[data-action="back"]').click();
      await expect(salesInput).toHaveValue(/^(?:\$\s*)?50(?:\.00)?$/);
      await salesInput.fill("1,000");
      await countInput.fill("50");
      await sales.locator("#fee-check-sales-next").click();
      await fees.locator("#fee-check-show-result").click();
      await expect(result.locator("#fee-check-result-rate")).toHaveText("3.2%");
      await expect(result.locator("#fee-check-result-average")).toHaveText("$20.00");
      await host.setViewportSize({ width: 1100, height: 850 });
      await host.screenshot({ path: testInfo.outputPath("fee-check-result.png") });

      const review = result.getByRole("link", { name: actionLabel, exact: true });
      await expect(review).toHaveAttribute("href", destination);
      await expect(review).toHaveAttribute("target", "_blank");
      await visitor.route(destination, (route) => route.fulfill({ body: "Fee review page" }));
      const openingReview = visitor.waitForEvent("page");
      await review.click();
      const reviewPage = await openingReview;
      await expect(reviewPage).toHaveURL(destination);
      await reviewPage.close();

      await result.locator('[data-action="restart"]').click();
      await statement.locator('[data-action="statement-yes"]').click();
      await expect(salesInput).toHaveValue("");
      await expect(countInput).toHaveValue("");
      await expect(feeInput).toHaveValue("");

      for (const width of [320, 390]) {
        await host.setViewportSize({ width, height: 844 });
        await host.goto(embeddedURL);
        await host.locator("iframe").evaluate((iframe) => { iframe.style.height = "780px"; });
        await statement.locator('[data-action="statement-yes"]').click();
        await expect(salesInput).toBeInViewport({ ratio: 1 });
        await expect(countInput).toBeInViewport({ ratio: 1 });
        await expect(sales.locator("#fee-check-sales-next")).toBeInViewport({ ratio: 1 });
        expect(await widget.evaluate((node) => node.ownerDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await host.screenshot({ path: testInfo.outputPath(`fee-check-mobile-${width}.png`) });
      }
      expect(widgetErrors).toEqual([]);
      await host.close();
    });

    await test.step("keep sign-in available without a trusted client IP", async () => {
      const probe = await visitor.newPage();
      for (let attempt = 0; attempt < 7; attempt++) {
        await probe.goto("/sign-in");
        await signIn(probe, rotated.username, "incorrect-password");
        await expect(probe.getByText("The username or password is incorrect.")).toBeVisible();
      }
      await probe.goto("/sign-in");
      await signIn(probe, rotated.username, rotated.password);
      await expect(probe).toHaveURL(/\/admin$/);
      await probe.close();
    });
  } finally {
    await visitor.close();
    await platform.close();
  }
});

test("recover from unknown pages and report authenticated publisher loads in the live dashboard", async ({ page, browser }, testInfo) => {
  const credentials = { username: "analytics-owner", password: randomBytes(24).toString("base64url") };
  const approvedKey = randomBytes(32).toString("hex");
  const otherKey = randomBytes(32).toString("hex");
  const platform = await startPlatform(credentials, {
    trustCloudflare: true,
    publisherKeys: { [approvedOrigin]: approvedKey, [otherOrigin]: otherKey },
  });
  const agent = "Widget Console analytics integration test";
  const visitor = await browser.newContext({
    baseURL: adminOrigin,
    ignoreHTTPSErrors: true,
    userAgent: agent,
    extraHTTPHeaders: { "CF-Connecting-IP": "192.0.2.10" },
  });
  const endpoint = "/api/admin/widget-analytics";
  // Isolate the optional publisher transport here. Automatic browser recording
  // is exercised end to end, without interception, in browser-analytics.spec.ts.
  await visitor.route((url) => url.pathname.startsWith("/embed/") && url.searchParams.has("view"),
    (route) => route.fulfill({ status: 204 }));
  try {
    const host = await visitor.newPage();
    const missing = await host.goto("/embed");
    expect(missing?.status()).toBe(404);
    await expect(host.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
    await expect(host.getByRole("main")).toHaveCSS("background-color", "rgb(247, 247, 240)");
    await host.screenshot({ path: testInfo.outputPath("not-found.png"), fullPage: true, animations: "disabled" });
    const home = host.getByRole("link", { name: "Return home", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await home.click();
    await expect(host).toHaveURL(/\/sign-in$/);
    expect((await analyticsAt(host, endpoint)).status).toBe(401);
    const unauthenticatedStream = await host.evaluate(async () => {
      const response = await fetch("/api/admin/live?topic=analytics", { signal: AbortSignal.timeout(5000) });
      return response.status;
    });
    expect(unauthenticatedStream).toBe(401);
    for (const path of ["/admin/analytics", `/admin/analytics/${platform.legacy.widgetId}`]) {
      await host.goto(path);
      await expect(host).toHaveURL(/\/sign-in$/);
    }

    await page.goto("/sign-in");
    await signIn(page, credentials.username, credentials.password);
    await expect(page).toHaveURL(/\/admin$/);
    expect((await analyticsAt(page, `${endpoint}?widgetId=${randomUUID()}`)).status).toBe(404);

    const firstPath = await createWidget(page, "freedom-fee-check", "Analytics first widget");
    const firstWidget = firstPath.split("/").pop();
    await expect(page.frameLocator('iframe[title="Widget preview"]').getByRole("heading", { name: "Fee Check" })).toBeVisible();
    await saveApprovedOrigins(page, approvedOrigin, otherOrigin);
    await page.getByRole("link", { name: "Embed links", exact: true }).click();
    const first = await createLink(page);
    const secondPath = await createWidget(page, "freedom-fee-check", "Analytics second widget");
    const secondWidget = secondPath.split("/").pop();
    await saveApprovedOrigins(page, otherOrigin);
    await page.getByRole("link", { name: "Embed links", exact: true }).click();
    const second = await createLink(page);

    await page.bringToFront();
    const overviewStream = waitForLiveStream(page, "analytics");
    await page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Analytics" }).click();
    await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh analytics", exact: true })).toBeVisible();
    const streamHeaders = (await overviewStream).headers();
    expect(streamHeaders["content-type"]).toContain("text/event-stream");
    expect(streamHeaders["cache-control"]).toContain("no-store");
    expect(streamHeaders["cache-control"]).toContain("no-transform");
    const loads = page.locator('[data-metric="views"]');
    await expect(loads).toHaveText("0");
    const overviewNavigation = await page.evaluate(() => performance.timeOrigin);

    const widget = host.frameLocator("iframe").getByRole("heading", { name: "Fee Check" });
    const firstEmbed = `${adminOrigin}/embed/${first.id}`;
    const secondVisitor = { "CF-Connecting-IP": "192.0.2.11", "User-Agent": agent };
    await test.step("serve frames and reject bare forged GET counting with browser receipts isolated", async () => {
      await host.goto(`${approvedOrigin}/${first.id}`);
      await expect(widget).toBeVisible();
      await host.reload();
      await expect(widget).toBeVisible();
      for (const url of [
        `${otherOrigin}/${first.id}`,
        `${otherOrigin}/${second.id}`,
      ]) {
        await host.goto(url);
        await expect(widget).toBeVisible();
      }
      await expectFrameBlocked(host, approvedOrigin, second.id);
      expect((await requestAt(visitor, firstEmbed, { ...iframeNavigation, ...secondVisitor, Referer: otherOrigin })).status()).toBe(200);
      expect((await requestAt(visitor, firstEmbed, { ...iframeNavigation, "User-Agent": agent, Referer: approvedOrigin, "CF-Connecting-IP": "" })).status()).toBe(200);
      expect((await requestAt(visitor, firstEmbed, { ...iframeNavigation, ...secondVisitor })).status()).toBe(200);
      expect((await requestAt(visitor, firstEmbed, { ...secondVisitor, Referer: otherOrigin })).status()).toBe(403);
      expect((await analyticsAt(page, endpoint)).data).toMatchObject({ views: 0, publisherViews: 0 });
      await expect(loads).toHaveText("0");
    });

    const approvedPublisher = { origin: approvedOrigin, key: approvedKey };
    const otherPublisher = { origin: otherOrigin, key: otherKey };
    await test.step("authorize each publisher and validate fresh event metadata", async () => {
      expect((await reportEmbedLoad(visitor, first.id, { origin: approvedOrigin })).status()).toBe(401);
      expect((await reportEmbedLoad(visitor, first.id, { ...approvedPublisher, key: randomBytes(32).toString("hex") })).status()).toBe(401);
      expect((await reportEmbedLoad(visitor, first.id, { ...approvedPublisher, key: otherKey })).status()).toBe(401);
      expect((await reportEmbedLoad(visitor, second.id, approvedPublisher)).status()).toBe(404);
      expect((await reportEmbedLoad(visitor, randomUUID(), approvedPublisher)).status()).toBe(404);
      expect((await reportEmbedLoad(visitor, first.id, { ...approvedPublisher, eventId: "invalid-id" })).status()).toBe(400);
      expect((await reportEmbedLoad(visitor, first.id, { ...approvedPublisher, eventTime: Date.now() - 600_000 })).status()).toBe(400);
      expect((await reportEmbedLoad(visitor, first.id, { ...approvedPublisher, eventTime: Date.now() + 600_000 })).status()).toBe(400);
      expect((await analyticsAt(page, endpoint)).data).toMatchObject({ views: 0, publisherViews: 0 });
    });

    await test.step("count authenticated publisher events once and update the open overview", async () => {
      const event = { ...approvedPublisher, eventId: randomUUID(), eventTime: Date.now() };
      const duplicate = await Promise.all([reportEmbedLoad(visitor, first.id, event), reportEmbedLoad(visitor, first.id, event)]);
      expect(duplicate.map((response) => response.status())).toEqual([204, 204]);
      await expect(loads).toHaveText("1", { timeout: 8_000 });
      expect((await reportEmbedLoad(visitor, first.id, approvedPublisher)).status()).toBe(204);
      expect((await reportEmbedLoad(visitor, first.id, otherPublisher)).status()).toBe(204);
      expect((await reportEmbedLoad(visitor, second.id, otherPublisher)).status()).toBe(204);
      await expect(loads).toHaveText("4", { timeout: 8_000 });
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(overviewNavigation);
    });
    await page.screenshot({ path: testInfo.outputPath("analytics.png"), fullPage: true });
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const navigation = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(navigation.getByRole("link", { name: "Analytics", exact: true })).toHaveAttribute("aria-current", "page");
    const beforeScroll = await navigation.boundingBox();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await navigation.boundingBox()).toEqual(beforeScroll);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("analytics-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    const report = await analyticsAt(page, `${endpoint}?range=7`);
    expect(report.status).toBe(200);
    expect(report.cacheControl).toContain("no-store");
    expect(report.data).toMatchObject({
      views: 4, publisherViews: 4, visitorDays: null, measuredViews: 0, range: 7,
      origins: expect.arrayContaining([
        expect.objectContaining({ origin: approvedOrigin, views: 2, visitorDays: null }),
        expect.objectContaining({ origin: otherOrigin, views: 2, visitorDays: null }),
      ]),
      widgets: expect.arrayContaining([
        expect.objectContaining({ widgetId: firstWidget, views: 3, visitorDays: null }),
        expect.objectContaining({ widgetId: secondWidget, views: 1, visitorDays: null }),
      ]),
    });
    const rangeRequest = page.waitForResponse((response) => response.url().includes(`${endpoint}?range=30`));
    await page.getByRole("button", { name: "30 days", exact: true }).click();
    expect(await (await rangeRequest).json()).toMatchObject({ range: 30, views: 4, publisherViews: 4 });

    await test.step("update an open analytics report for one widget", async () => {
      const widgetStream = waitForLiveStream(page, "analytics");
      await page.goto(`/admin/analytics/${firstWidget}`);
      await expect(page.getByRole("heading", { name: "Analytics first widget", exact: true })).toBeVisible();
      expect((await widgetStream).ok()).toBe(true);
      await expect(loads).toHaveText("3");
      expect((await reportEmbedLoad(visitor, first.id, approvedPublisher)).status()).toBe(204);
      await expect(loads).toHaveText("4", { timeout: 8_000 });
    });

    await page.goto(`${secondPath}?tab=links`);
    await test.step("update an inventory open in a different admin session", async () => {
      const observer = await browser.newContext({ baseURL: adminOrigin, ignoreHTTPSErrors: true });
      try {
        const inventory = await observer.newPage();
        await inventory.goto("/sign-in");
        await inventory.bringToFront();
        const inventoryStream = waitForLiveStream(inventory, "widgets");
        await signIn(inventory, credentials.username, credentials.password);
        expect((await inventoryStream).ok()).toBe(true);
        const linkCount = inventory.getByRole("link", { name: "Open Analytics second widget", exact: true });
        await expect(linkCount).toContainText("1 of 1 active link");
        const inventoryNavigation = await inventory.evaluate(() => performance.timeOrigin);

        await second.row.getByText("Manage link", { exact: true }).click();
        await second.row.getByText("Disable link", { exact: true }).click();
        await second.row.getByRole("button", { name: "Confirm disable", exact: true }).click();
        await expect(second.row.getByText("Disabled", { exact: true })).toBeVisible();
        await expect(linkCount).toContainText("0 of 1 active link", { timeout: 8_000 });
        expect(await inventory.evaluate(() => performance.timeOrigin)).toBe(inventoryNavigation);
      } finally {
        await observer.close();
      }
    });
    const disabled = await requestAt(visitor, `${adminOrigin}/embed/${second.id}`, { ...iframeNavigation, ...secondVisitor, Referer: otherOrigin });
    expect(disabled.status()).toBe(404);
    expect((await reportEmbedLoad(visitor, second.id, otherPublisher)).status()).toBe(404);
    const widgetReport = await analyticsAt(page, `${endpoint}?widgetId=${secondWidget}`);
    expect(widgetReport.data).toMatchObject({ views: 1, publisherViews: 1, visitorDays: null });

    await test.step("report loads for a previously issued embed without changing its link", async () => {
      const [legacy] = platform.legacy.links;
      await host.goto(`${legacy.origin}/${legacy.id}`);
      await expect(widget).toBeVisible();
      const legacyReport = `${endpoint}?widgetId=${platform.legacy.widgetId}`;
      expect((await analyticsAt(page, legacyReport)).data).toMatchObject({ views: 0, publisherViews: 0 });
      expect((await reportEmbedLoad(visitor, legacy.id, approvedPublisher)).status()).toBe(204);
      expect((await analyticsAt(page, legacyReport)).data).toMatchObject({ views: 1, publisherViews: 1 });
    });

    await test.step("bound publisher writes for one origin without blocking other embeds", async () => {
      const widgetReport = `${endpoint}?widgetId=${firstWidget}`;
      const before = await analyticsAt(page, widgetReport);
      const statuses: number[] = [];
      // Send enough distinct reports to exceed the quota even across a minute boundary.
      for (let batch = 0; batch < 6; batch++) {
        const responses = await Promise.all(Array.from({ length: 21 }, () => reportEmbedLoad(visitor, first.id, approvedPublisher)));
        statuses.push(...responses.map((response) => response.status()));
      }
      expect(statuses.every((status) => status === 204 || status === 429)).toBe(true);
      expect(statuses).toContain(429);
      const accepted = statuses.filter((status) => status === 204).length;
      const after = await analyticsAt(page, widgetReport);
      expect(after.data.publisherViews).toBe(before.data.publisherViews + accepted);
      expect((await reportEmbedLoad(visitor, first.id, otherPublisher)).status()).toBe(204);
      await host.goto(`${approvedOrigin}/${first.id}`);
      await expect(widget).toBeVisible();
    });

    await test.step("throttle one trusted source without blocking another source's sign-in", async () => {
      await host.setExtraHTTPHeaders({ "CF-Connecting-IP": "192.0.2.40" });
      for (let attempt = 0; attempt < 12; attempt++) {
        await host.goto("/sign-in");
        await signIn(host, attempt % 2 ? credentials.username : "fixture-alias", "incorrect-password");
        await expect(host.getByText("The username or password is incorrect.")).toBeVisible();
      }
      await host.goto("/sign-in");
      await signIn(host, credentials.username, credentials.password);
      await expect(host.getByText(/Too many attempts/)).toBeVisible();

      await host.setExtraHTTPHeaders({ "CF-Connecting-IP": "192.0.2.41" });
      await host.goto("/sign-in");
      await signIn(host, credentials.username, credentials.password);
      await expect(host).toHaveURL(/\/admin$/);
    });
  } finally {
    await visitor.close();
    await platform.close();
  }
});
