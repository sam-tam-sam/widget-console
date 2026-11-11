import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { adminOrigin, approvedOrigin, startPlatform } from "./platform-server";

async function recordCount(page: Page, widgetId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/admin/widget-analytics?widgetId=${id}`);
    if (!response.ok) throw new Error(`Analytics request failed: ${response.status}`);
    const report = await response.json() as { browserViews: number };
    return report.browserViews;
  }, widgetId);
}

async function expectPopupToFit(popup: FrameLocator, withAction: boolean) {
  const panel = popup.getByRole("main");
  const artwork = popup.getByRole("img", { name: "Offer image" });
  const close = popup.getByRole("button", { name: "Close popup", exact: true });
  await expect(artwork).toBeVisible();
  await expect(artwork).toHaveJSProperty("naturalHeight", 1200);
  await expect(artwork).toHaveCSS("object-fit", "contain");
  await expect(close).toBeVisible();

  const action = popup.getByRole("link", { name: "Learn more", exact: true });
  if (withAction) {
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute("href", "https://example.com/offer");
  } else {
    await expect(action).toHaveCount(0);
  }

  const layout = await panel.evaluate((element) => {
    const { documentElement, body } = element.ownerDocument;
    const roots = [documentElement, body, element];
    const panelBox = element.getBoundingClientRect();
    const artworkBox = element.querySelector("img")!.getBoundingClientRect();
    const closeBox = element.querySelector("[data-widget-close]")!.getBoundingClientRect();
    const actionBox = element.querySelector(".popup-action")?.getBoundingClientRect();
    return {
      closeOverlap: closeBox.bottom - artworkBox.top,
      artworkOverflow: artworkBox.bottom - panelBox.bottom,
      action: actionBox && {
        horizontalOffset: Math.abs((actionBox.x + actionBox.width / 2) - (panelBox.x + panelBox.width / 2)),
        overlap: artworkBox.bottom - actionBox.top,
        overflow: actionBox.bottom - panelBox.bottom,
      },
      horizontal: Math.max(...roots.map((root) => root.scrollWidth - root.clientWidth)),
      vertical: Math.max(...roots.map((root) => root.scrollHeight - root.clientHeight)),
      scrollContainers: [...element.querySelectorAll("*")].filter((child) => {
        const { overflowX, overflowY } = getComputedStyle(child);
        return ((overflowX === "scroll" || overflowX === "auto") && child.scrollWidth > child.clientWidth) ||
          ((overflowY === "scroll" || overflowY === "auto") && child.scrollHeight > child.clientHeight);
      }).length,
    };
  });
  expect(layout.closeOverlap).toBeLessThanOrEqual(1);
  expect(layout.artworkOverflow).toBeLessThanOrEqual(1);
  if (withAction) {
    if (!layout.action) throw new Error("Popup action must have visible bounds");
    expect(layout.action.horizontalOffset).toBeLessThanOrEqual(2);
    expect(layout.action.overlap).toBeLessThanOrEqual(1);
    expect(layout.action.overflow).toBeLessThanOrEqual(1);
  }
  expect(layout.horizontal).toBeLessThanOrEqual(1);
  expect(layout.vertical).toBeLessThanOrEqual(1);
  expect(layout.scrollContainers).toBe(0);
}

test("popup uploads persist and only actual opens count on the host", async ({ page, browser }) => {
  const credentials = { username: "popup-test-owner", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(credentials);
  const visitor = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Username", { exact: true }).fill(credentials.username);
    await page.getByLabel("Password", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/widgets/new");
    await page.getByLabel("Template", { exact: true }).selectOption("popup");
    await page.getByLabel("Widget name", { exact: true }).fill("Popup fixture");
    await page.getByRole("button", { name: "Create widget", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/widgets\/[a-f0-9-]+$/);
    const widgetPath = new URL(page.url()).pathname;
    const widgetId = widgetPath.split("/").at(-1)!;

    await test.step("reject unsupported, mislabeled, and oversized uploads, then save a real image", async () => {
      const png = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 1200;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#124b5c";
        context.fillRect(0, 0, 960, 1200);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      const bytes = Buffer.from(png, "base64");
      const uploadInput = page.getByLabel("Choose an image", { exact: true });
      const uploadButton = page.getByRole("button", { name: "Upload image", exact: true });

      for (const file of [
        { name: "unsupported.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") },
        { name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("This is not a PNG.") },
        { name: "oversized.png", mimeType: "image/png", buffer: Buffer.concat([bytes, Buffer.alloc(5 * 1024 * 1024)]) },
      ]) {
        await uploadInput.setInputFiles(file);
        const rejected = page.waitForResponse((response) => response.url().endsWith(`/widget-image/${widgetId}`));
        await uploadButton.click();
        const status = (await rejected).status();
        expect(status, file.name).toBeGreaterThanOrEqual(400);
        expect(status, file.name).toBeLessThan(500);
        await expect(page.getByRole("region", { name: "Popup image" }).getByRole("alert")).toBeVisible();
      }

      await uploadInput.setInputFiles({ name: "offer.png", mimeType: "image/png", buffer: bytes });
      const refreshRequests = (url: URL) => url.pathname === widgetPath && url.searchParams.has("_rsc");
      let resumeRefresh!: () => void;
      const refreshAllowed = new Promise<void>((resolve) => { resumeRefresh = resolve; });
      await page.route(refreshRequests, async (route) => {
        await refreshAllowed;
        await route.continue();
      });
      try {
        await uploadButton.click();
        await expect(page.getByText(/Uploaded image.*960 × 1200px/)).toBeVisible();
        await expect(page.locator(".console-widget-image img")).toHaveJSProperty("naturalWidth", 960);
      } finally {
        resumeRefresh();
        await page.unrouteAll({ behavior: "wait" });
      }
      await page.getByLabel("Image alternative text", { exact: true }).fill("Offer image");
      await page.getByLabel("Open popup", { exact: true }).selectOption("click");
      await page.getByLabel("Host trigger selector", { exact: true }).fill("#offer-trigger");
      await page.getByLabel("Frequency", { exact: true }).selectOption("always");
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();
    });

    await test.step("derive image dimensions and save responsive overrides", async () => {
      await page.getByRole("link", { name: "Size", exact: true }).click();
      const desktopWidth = page.getByLabel("Desktop width (px)", { exact: true });
      const desktopHeight = page.getByLabel("Desktop height (px)", { exact: true });
      const suggestedWidth = Number(await desktopWidth.getAttribute("placeholder"));
      const suggestedHeight = Number(await desktopHeight.getAttribute("placeholder"));
      expect(suggestedWidth).toBeGreaterThan(0);
      expect(suggestedWidth).toBeLessThan(suggestedHeight);
      await desktopWidth.fill("520");
      await desktopHeight.fill("660");
      await page.getByLabel("Phone width (px)", { exact: true }).fill("280");
      await page.getByLabel("Phone height (px)", { exact: true }).fill("220");
      const phoneScale = page.getByRole("slider", { name: "Phone scale (%)", exact: true });
      await phoneScale.press("End");
      for (let step = 0; step < 20; step++) await phoneScale.press("ArrowLeft");
      await expect(phoneScale).toHaveValue("80");
      await page.getByRole("button", { name: "Save sizes", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /sizes saved/i })).toBeVisible();
    });

    await page.goto(widgetPath);
    await page.getByLabel("Title", { exact: true }).fill("Portrait artwork offer");
    await page.getByLabel("Description", { exact: true }).fill("See the full offer below.");
    await page.getByLabel("Button URL", { exact: true }).fill("https://example.com/offer");
    await expect(page.getByLabel("Show action button", { exact: true })).toHaveValue("yes");
    await page.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();

    await page.getByRole("link", { name: "Approved origins", exact: true }).click();
    await page.getByRole("textbox", { name: "Approved origins", exact: true }).fill(approvedOrigin);
    await page.getByRole("button", { name: "Save approved origins", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Approved origins saved." })).toBeVisible();
    await page.getByRole("link", { name: "Embed links", exact: true }).click();
    await page.getByRole("button", { name: "Create embed link", exact: true }).click();
    const link = page.locator("[data-link-id]");
    await expect(link).toHaveCount(1);
    const linkId = (await link.getAttribute("data-link-id"))!;
    await page.getByText("View head script", { exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Head script", exact: true })).toHaveValue(
      `<script src="${adminOrigin}/widget-embed/v1.js" data-widget-id="${linkId}" defer></script>`,
    );
    const hostUrl = `${approvedOrigin}/script/${linkId}?duplicate=1`;
    const host = await visitor.newPage();
    const opener = host.getByRole("button", { name: "Open offer", exact: true });
    const dialog = host.getByRole("dialog", { name: "Popup", exact: true });
    const frame = host.locator('iframe[title="Popup content"]');
    const popup = host.frameLocator('iframe[title="Popup content"]');

    await test.step("restart the production process and preview the saved image without a view", async () => {
      await platform.restart(credentials);
      // A restrictive proxy may block media requests from an opaque iframe.
      const media = "**/widget-media/*";
      await page.route(media, (route) => route.request().frame() === page.mainFrame() ? route.continue() : route.abort());
      try {
        await page.goto(widgetPath + "?tab=preview");
        await page.getByRole("button", { name: "320px", exact: true }).click();
        const previewOpener = page.getByRole("button", { name: "Open popup", exact: true });
        await previewOpener.click();
        const preview = page.frameLocator('iframe[title="Widget preview"]');
        const image = preview.getByRole("img", { name: "Offer image" });
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
        await expect(image).toHaveJSProperty("naturalWidth", 960);
        await expectPopupToFit(preview, true);
        const previewPanel = page.locator(".widget-host-preview-popup");
        await expect(previewPanel).toHaveCSS("width", "280px");
        await expect(previewPanel).toHaveCSS("transform", "matrix(0.8, 0, 0, 0.8, 0, 0)");
        const previewBackdrop = page.getByRole("dialog", { name: "Popup preview" });
        await previewBackdrop.click({ position: { x: 4, y: 4 } });
        await expect(previewBackdrop).toBeHidden();
        await expect(previewOpener).toBeFocused();
      } finally {
        await page.unroute(media);
      }
      expect(await recordCount(page, widgetId)).toBe(0);
    });

    await test.step("open and dismiss at three widths with head, body, and late scripts", async () => {
      for (const [index, { width, placement }] of [
        { width: 320, placement: "head" },
        { width: 390, placement: "body" },
        { width: 1280, placement: "late" },
      ].entries()) {
        await host.setViewportSize({ width, height: 720 });
        await host.emulateMedia({ reducedMotion: index === 1 ? "reduce" : "no-preference" });
        const ready = host.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
        await host.goto(`${hostUrl}&placement=${placement}`);
        expect((await ready).status()).toBe(200);
        await expect(dialog).toHaveCount(0);
        expect(await recordCount(page, widgetId)).toBe(index);
        await opener.click();
        await expect(dialog).toBeVisible();
        await expect(frame).toHaveCount(1);
        await expect(frame).toHaveCSS("width", width < 600 ? "280px" : "520px");
        await expect(frame).toHaveCSS("height", width < 600 ? "220px" : "660px");
        await expect.poll(async () => {
          const rect = await frame.boundingBox();
          return rect && [Math.round(rect.width), Math.round(rect.height)];
        }).toEqual(width < 600 ? [224, 176] : [520, 660]);
        if (index === 1) {
          expect(await frame.evaluate((element) => element.getAnimations().length)).toBe(0);
        }
        await expectPopupToFit(popup, true);
        await expect(popup.getByRole("heading", { name: "Portrait artwork offer", exact: true })).toBeVisible();
        if (width === 1280) {
          const action = popup.getByRole("link", { name: "Learn more", exact: true });
          await action.hover();
          await expect(action).not.toHaveCSS("transform", "none");
        }
        const close = popup.getByRole("button", { name: "Close popup", exact: true });
        await expect(close).toBeFocused();
        if (index === 0) await close.press("Escape");
        else if (index === 1) await host.mouse.click(4, 4);
        else await close.click();
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
        await expect.poll(() => recordCount(page, widgetId)).toBe(index + 1);
      }

      await opener.click();
      await expect(dialog).toBeVisible();
      await popup.getByRole("button", { name: "Close popup", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(() => recordCount(page, widgetId)).toBe(4);
    });

    await test.step("open after the configured delay once in the current tab session", async () => {
      await page.goto(widgetPath);
      await page.getByLabel("Title", { exact: true }).fill("A long popup at a narrow viewport");
      await page.getByLabel("Description", { exact: true }).fill("Read the offer terms below. ".repeat(24));
      await page.getByLabel("Button URL", { exact: true }).fill("https://example.com/offer");
      await page.getByLabel("Open popup", { exact: true }).selectOption("delay");
      await page.getByLabel("Delay (seconds)", { exact: true }).fill("5");
      await page.getByLabel("Frequency", { exact: true }).selectOption("session");
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();
      await host.setViewportSize({ width: 320, height: 220 });
      const now = Date.now();
      await host.clock.install({ time: now });
      await host.clock.pauseAt(now + 1000);
      const ready = host.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
      await host.goto(`${hostUrl}&placement=body`);
      await (await ready).finished();
      await host.clock.runFor(4000);
      await expect(dialog).toHaveCount(0);
      await host.clock.runFor(1500);
      await expect(dialog).toBeVisible();
      await host.clock.resume();
      await expectPopupToFit(popup, true);
      await visitor.route("https://example.com/offer", (route) => route.fulfill({ body: "Offer fixture" }));
      const opened = host.waitForEvent("popup");
      await popup.getByRole("img", { name: "Offer image" }).click();
      const destination = await opened;
      await expect(destination).toHaveURL("https://example.com/offer");
      await destination.close();
      await host.setViewportSize({ width: 320, height: 194 });
      await expect(frame).toHaveCSS("height", "170px");
      await expectPopupToFit(popup, true);
      await popup.getByRole("button", { name: "Close popup", exact: true }).click();
      await expect.poll(() => recordCount(page, widgetId)).toBe(5);
      const reloaded = host.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
      await host.reload();
      await (await reloaded).finished();
      await host.clock.runFor(6000);
      await expect(dialog).toHaveCount(0);
      expect(await recordCount(page, widgetId)).toBe(5);
    });

    await test.step("hide the action while retaining the artwork link and enforce a two-open session limit", async () => {
      await page.getByLabel("Open popup", { exact: true }).selectOption("click");
      await page.getByLabel("Show action button", { exact: true }).selectOption("no");
      await page.getByLabel("Maximum opens per tab session", { exact: true }).fill("2");
      const save = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === page.url());
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await (await save).finished();
      await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();
      const freshTab = await visitor.newPage();
      const trigger = freshTab.getByRole("button", { name: "Open offer", exact: true });
      const modal = freshTab.getByRole("dialog", { name: "Popup", exact: true });
      const freshPopup = freshTab.frameLocator('iframe[title="Popup content"]');
      const close = freshPopup.getByRole("button", { name: "Close popup", exact: true });
      const ready = freshTab.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
      await freshTab.goto(hostUrl);
      await (await ready).finished();
      for (const total of [6, 7]) {
        await trigger.click();
        await expect(modal).toBeVisible();
        await expectPopupToFit(freshPopup, false);
        await expect(freshPopup.locator("a:has(img)")).toHaveAttribute("href", "https://example.com/offer");
        await close.click();
        await expect(modal).toBeHidden();
        await expect.poll(() => recordCount(page, widgetId)).toBe(total);
      }
      await trigger.click();
      await expect(modal).toHaveCount(0);
      expect(await recordCount(page, widgetId)).toBe(7);
    });
  } finally {
    await visitor.close();
    await platform.close();
  }
});
