export type WidgetHostFrame = { parentOrigin: string; channel: string };

export const widgetChannelPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export const hostOpenedEvent = "widget-console:opened";

// The sandbox gives the child an opaque origin. In this direction the parent
// has a known origin, and both the browsing context and channel must match.
export const hostFrameScript = `(() => {
  const { parentOrigin, channel, kind } = document.currentScript.dataset;
  if (window.parent === window) return;
  const send = (type, extra = {}) => window.parent.postMessage({ widgetConsole: 1, channel, type, ...extra }, parentOrigin);
  const close = document.querySelector("[data-widget-close]");
  let opened = false;
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (opened || event.source !== window.parent || event.origin !== parentOrigin ||
      !data || typeof data !== "object" || Object.keys(data).length !== 3 ||
      data.widgetConsole !== 1 || data.channel !== channel || data.type !== "opened") return;
    opened = true;
    document.documentElement.dataset.widgetOpened = "true";
    if (kind === "popup") close?.focus({ preventScroll: true });
    document.dispatchEvent(new Event(${JSON.stringify(hostOpenedEvent)}));
  });
  close?.addEventListener("click", () => { if (opened) send("close"); });
  if (kind === "popup") {
    window.addEventListener("keydown", (event) => {
      if (opened && event.key === "Escape") {
        event.preventDefault();
        send("close");
      }
    });
  }
  const content = document.querySelector("[data-widget-content]");
  if (kind === "announcement" && content) {
    let previous = 0;
    const resize = () => {
      const height = Math.ceil(content.getBoundingClientRect().height);
      if (height > 0 && height <= 2400 && height !== previous) {
        previous = height;
        send("resize", { height });
      }
    };
    new ResizeObserver(resize).observe(content);
    resize();
  }
  send("ready");
})();`;
