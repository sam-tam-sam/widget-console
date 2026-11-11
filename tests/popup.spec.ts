import { expect, test, type Page } from "@playwright/test";
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
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#124b5c";
        context.fillRect(0, 0, 960, 480);
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
      await uploadButton.click();
      await expect(page.getByText(/Uploaded image.*960 × 480px/)).toBeVisible();
      await page.getByLabel("Image alternative text", { exact: true }).fill("Offer image");
      await page.getByLabel("Open popup", { exact: true }).selectOption("click");
      await page.getByLabel("Host trigger selector", { exact: true }).fill("#offer-trigger");
      await page.getByLabel("Frequency", { exact: true }).selectOption("always");
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();
    });

    await test.step("derive image dimensions and save responsive overrides", async () => {
      await page.getByRole("link", { name: "Size", exact: true }).click();
      await expect(page.getByLabel("Desktop width (px)", { exact: true })).toHaveAttribute("placeholder", "960");
      await expect(page.getByLabel("Desktop height (px)", { exact: true })).toHaveAttribute("placeholder", "480");
      await page.getByLabel("Phone width (px)", { exact: true }).fill("280");
      await page.getByLabel("Phone height (px)", { exact: true }).fill("220");
      await page.getByRole("button", { name: "Save sizes", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /sizes saved/i })).toBeVisible();
    });

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
      await page.goto(widgetPath + "?tab=preview");
      await page.getByRole("button", { name: "Open popup", exact: true }).click();
      const preview = page.frameLocator('iframe[title="Widget preview"]');
      await expect(preview.getByRole("img", { name: "Offer image" })).toBeVisible();
      await expect.poll(() => preview.getByRole("img", { name: "Offer image" }).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(960);
      expect(await recordCount(page, widgetId)).toBe(0);
    });

    await test.step("open and dismiss on three screen sizes using the same published link", async () => {
      for (const [index, width] of [320, 390, 1280].entries()) {
        await host.setViewportSize({ width, height: 720 });
        const ready = host.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
        await host.goto(hostUrl);
        expect((await ready).status()).toBe(200);
        await expect(dialog).toHaveCount(0);
        expect(await recordCount(page, widgetId)).toBe(index);
        await opener.click();
        await expect(dialog).toBeVisible();
        await expect(frame).toHaveCount(1);
        await expect(frame).toHaveCSS("width", width < 600 ? "280px" : "960px");
        await expect(frame).toHaveCSS("height", width < 600 ? "220px" : "480px");
        const image = popup.getByRole("img", { name: "Offer image" });
        await expect(image).toHaveCSS("object-fit", "contain");
        await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(960);
        expect(await popup.locator("html").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
        const close = popup.getByRole("button", { name: "Close popup", exact: true });
        await expect(close).toBeFocused();
        if (index === 0) await close.press("Escape");
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
      await host.setViewportSize({ width: 320, height: 520 });
      const now = Date.now();
      await host.clock.install({ time: now });
      await host.clock.pauseAt(now + 1000);
      const ready = host.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
      await host.goto(hostUrl);
      await (await ready).finished();
      await host.clock.runFor(4000);
      await expect(dialog).toHaveCount(0);
      await host.clock.runFor(1500);
      await expect(dialog).toBeVisible();
      await host.clock.resume();
      const content = popup.getByRole("region", { name: "Popup content", exact: true });
      await content.focus();
      await content.press("End");
      await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(popup.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "https://example.com/offer");
      await popup.getByRole("button", { name: "Close popup", exact: true }).click();
      await expect.poll(() => recordCount(page, widgetId)).toBe(5);
      const reloaded = host.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
      await host.reload();
      await (await reloaded).finished();
      await host.clock.runFor(6000);
      await expect(dialog).toHaveCount(0);
      expect(await recordCount(page, widgetId)).toBe(5);
    });

    await test.step("enforce a custom session limit of two opens", async () => {
      await page.getByLabel("Open popup", { exact: true }).selectOption("click");
      await page.getByLabel("Maximum opens per tab session", { exact: true }).fill("2");
      const save = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === page.url());
      await page.getByRole("button", { name: "Save settings", exact: true }).click();
      await (await save).finished();
      await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();
      const freshTab = await visitor.newPage();
      const trigger = freshTab.getByRole("button", { name: "Open offer", exact: true });
      const modal = freshTab.getByRole("dialog", { name: "Popup", exact: true });
      const close = freshTab.frameLocator('iframe[title="Popup content"]').getByRole("button", { name: "Close popup", exact: true });
      const ready = freshTab.waitForResponse((response) => new URL(response.url()).pathname === `/api/embed-config/${linkId}`);
      await freshTab.goto(hostUrl);
      await (await ready).finished();
      for (const total of [6, 7]) {
        await trigger.click();
        await expect(modal).toBeVisible();
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
