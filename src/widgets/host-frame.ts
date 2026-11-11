export type WidgetHostFrame = { parentOrigin: string; channel: string };

export const widgetChannelPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export const hostOpenedEvent = "widget-console:opened";

// The sandbox gives the child an opaque origin. In this direction the parent
// has a known origin, and both the browsing context and channel must match.
export const hostFrameScript = `(() => {
  const { parentOrigin, channel } = document.currentScript.dataset;
  if (window.parent === window) return;
  const send = (type) => window.parent.postMessage({ widgetConsole: 1, channel, type }, parentOrigin);
  const close = document.querySelector("[data-widget-close]");
  let opened = false;
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (opened || event.source !== window.parent || event.origin !== parentOrigin ||
      !data || typeof data !== "object" || Object.keys(data).length !== 3 ||
      data.widgetConsole !== 1 || data.channel !== channel || data.type !== "opened") return;
    opened = true;
    document.documentElement.dataset.widgetOpened = "true";
    close?.focus({ preventScroll: true });
    document.dispatchEvent(new Event(${JSON.stringify(hostOpenedEvent)}));
  });
  close?.addEventListener("click", () => { if (opened) send("close"); });
  window.addEventListener("keydown", (event) => {
    if (opened && event.key === "Escape") {
      event.preventDefault();
      send("close");
    }
  });
  const image = document.querySelector("img[data-widget-ready-image]");
  if (image) {
    image.decode().then(() => send("ready"), () => send("unavailable"));
  } else {
    send("ready");
  }
})();`;
