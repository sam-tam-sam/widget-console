import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { get, type IncomingMessage } from "node:http";
import { adminOrigin, backendOrigin, startPlatform } from "./platform-server";

async function signIn(page: Page, credentials: { username: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Username", { exact: true }).fill(credentials.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const cookies = await page.context().cookies(adminOrigin);
  const session = cookies.find(({ name }) => name === "widget_admin_session");
  if (!session) throw new Error("The test administrator did not receive a session cookie.");
  return `${session.name}=${session.value}`;
}

function widgetStream(cookie: string, signal: AbortSignal) {
  const host = new URL(adminOrigin).host;
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = get(`${backendOrigin}/api/admin/live?topic=widgets`, {
      headers: { Host: host, "X-Forwarded-Host": host, "X-Forwarded-Proto": "https", Cookie: cookie },
      signal,
    }, resolve);
    request.once("error", reject);
  });
}

async function openWidgetStream(cookie: string, signal: AbortSignal) {
  const response = await widgetStream(cookie, signal);
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toContain("text/event-stream");

  const chunks = response[Symbol.asyncIterator]();
  const decoder = new TextDecoder();
  let buffer = "";
  return async function readFrame() {
    let end = buffer.indexOf("\n\n");
    while (end === -1) {
      const { done, value } = await chunks.next();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
      end = buffer.indexOf("\n\n");
    }
    const frame = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    return frame;
  };
}

test("an open administrator stream stops delivering widget events after sign-out", async ({ page, browser }) => {
  const credentials = { username: "live-stream-owner", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(credentials);
  const streams = new AbortController();
  const secondContext = await browser.newContext({ baseURL: adminOrigin, ignoreHTTPSErrors: true });
  try {
    const revokedCookie = await signIn(page, credentials);
    const activePage = await secondContext.newPage();
    const activeCookie = await signIn(activePage, credentials);
    await activePage.goto("/admin/widgets/new");
    await activePage.getByLabel("Template", { exact: true }).selectOption("freedom-fee-check");
    await activePage.getByLabel("Widget name", { exact: true }).fill("Widget created after sign-out");

    // The raw clients keep their streams independent of browser navigation and cookie removal.
    const signal = AbortSignal.any([streams.signal, AbortSignal.timeout(10_000)]);
    const [readRevoked, readActive] = await Promise.all([
      openWidgetStream(revokedCookie, signal),
      openWidgetStream(activeCookie, signal),
    ]);
    expect(await readRevoked()).toContain("event: ready");
    expect(await readActive()).toContain("event: ready");

    await page.bringToFront();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    const denied = await widgetStream(revokedCookie, signal);
    expect(denied.statusCode).toBe(401);
    denied.resume();

    await activePage.getByRole("button", { name: "Create widget", exact: true }).click();
    await expect(activePage).toHaveURL(/\/admin\/widgets\/[a-f0-9-]+$/);
    const widgetId = new URL(activePage.url()).pathname.split("/").at(-1);
    expect(await readActive()).toBe(`event: change\ndata: ${widgetId}`);
    expect(await readRevoked()).toBeNull();
  } finally {
    streams.abort();
    await secondContext.close();
    await platform.close();
  }
});
