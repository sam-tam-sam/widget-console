(() => {
  "use strict";

  const script = document.currentScript;
  const id = script?.dataset.widgetId;
  if (!id || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return;
  if (location.protocol !== "https:" || !script.src || !globalThis.crypto?.randomUUID) return;

  const origin = new URL(script.src).origin;
  if (!origin.startsWith("https://")) return;
  const key = `${origin}/${id}`;
  const registryKey = Symbol.for("widget-console.host-embeds");
  const registry = window[registryKey] ??= { installed: new Set(), activePopup: null };
  if (registry.installed.has(key)) return;
  registry.installed.add(key);

  const loadTimeout = 10_000;
  const maxSize = 4096;
  const profiles = [
    ["phone", 600], ["tablet", 900], ["medium", 1200], ["desktop", Infinity],
  ];
  const integerBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  function validConfig(config) {
    return config?.kind === "popup" &&
      (config.trigger === "delay" || config.trigger === "click") &&
      integerBetween(config.delayMs, 0, 3_600_000) &&
      typeof config.triggerSelector === "string" && config.triggerSelector.length <= 300 &&
      (config.frequency === "always" || config.frequency === "session") &&
      Number.isSafeInteger(config.sessionLimit) && config.sessionLimit >= 1 &&
      profiles.every(([profile]) => {
        const size = config.sizes?.[profile];
        return integerBetween(size?.width, 1, maxSize) && integerBetween(size?.height, 1, maxSize) &&
          (size.scale === undefined || integerBetween(size.scale, 10, 100));
      });
  }

  function widgetFrame(title, onMessage, onTimeout) {
    const channel = crypto.randomUUID();
    const element = document.createElement("iframe");
    element.title = title;
    element.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");
    Object.assign(element.style, {
      display: "block", border: "0", padding: "0", margin: "0", background: "transparent",
    });
    const url = new URL(`/embed/${id}`, origin);
    url.search = new URLSearchParams({ host: "1", parent: location.origin, channel }).toString();
    element.src = url.href;

    function receive(event) {
      // The browser assigns the sandboxed iframe an opaque origin.
      if (event.source !== element.contentWindow || event.origin !== "null") return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.widgetConsole !== 1 || data.channel !== channel) return;
      const fields = Object.keys(data).length;
      if (fields === 3 && (data.type === "ready" || data.type === "close" || data.type === "unavailable")) onMessage(data);
    }
    window.addEventListener("message", receive);
    const timeout = setTimeout(onTimeout, loadTimeout);
    return {
      element,
      ready() { clearTimeout(timeout); },
      opened() {
        element.contentWindow?.postMessage({ widgetConsole: 1, channel, type: "opened" }, "*");
      },
      remove() {
        clearTimeout(timeout);
        window.removeEventListener("message", receive);
        element.remove();
      },
    };
  }

  function popup(config, pageReadyTime) {
    const dialog = document.createElement("dialog");
    if (typeof dialog.showModal !== "function") return;
    dialog.setAttribute("aria-label", "Popup");
    Object.assign(dialog.style, {
      position: "fixed", inset: "0", margin: "0", padding: "0", border: "0", width: "100%",
      height: CSS.supports("height", "100dvh") ? "100dvh" : "100vh",
      maxWidth: "none", maxHeight: "none", overflow: "hidden", boxSizing: "border-box",
      overscrollBehavior: "contain", background: "rgba(12, 18, 25, 0.67)",
      display: "none", placeItems: "center", gridTemplate: "minmax(0, 1fr) / minmax(0, 1fr)",
    });

    const sessionKey = `widget-console:shown:${key}`;
    let openings = 0;
    let frame;
    let returnFocus;

    function sessionOpenings() {
      try {
        const stored = Number(sessionStorage.getItem(sessionKey));
        return Number.isSafeInteger(stored) && stored >= 0 ? Math.max(openings, stored) : openings;
      } catch {
        return openings;
      }
    }

    function setSize() {
      const width = document.documentElement.clientWidth;
      const [profile] = profiles.find(([, maximum]) => width < maximum);
      const gutter = profile === "phone" ? 24 : 48;
      const size = config.sizes[profile];
      Object.assign(frame.element.style, {
        width: `${size.width}px`, height: `${size.height}px`,
        maxWidth: `calc(100% - ${gutter}px)`, maxHeight: `calc(100% - ${gutter}px)`,
        transform: `scale(${(size.scale ?? 100) / 100})`,
      });
    }

    function animateOpening() {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      dialog.animate?.([
        { backgroundColor: "transparent" }, { backgroundColor: dialog.style.backgroundColor },
      ], { duration: 180, easing: "ease-out" });
      // The individual scale multiplies the saved transform without overwriting it.
      frame.element.animate?.([
        { opacity: 0, scale: ".84" },
        { opacity: 1, scale: "1" },
      ], { duration: 280, easing: "cubic-bezier(.2, .72, .26, 1)" });
    }

    function release() {
      dialog.style.display = "none";
      window.removeEventListener("resize", setSize);
      if (registry.activePopup === dialog) registry.activePopup = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = undefined;
    }

    function failed() {
      frame?.remove();
      frame = undefined;
      dialog.remove();
      release();
    }

    function close() {
      if (!dialog.open) return;
      dialog.close();
      dialog.style.display = "none";
    }

    function open(trigger) {
      if (registry.activePopup || (config.frequency === "session" && sessionOpenings() >= config.sessionLimit)) return;
      registry.activePopup = dialog;
      frame?.remove();
      frame = widgetFrame("Popup content", ({ type }) => {
        if (type === "close") close();
        if (type === "unavailable" && !dialog.open && registry.activePopup === dialog) failed();
        if (type !== "ready" || dialog.open || registry.activePopup !== dialog) return;
        frame.ready();
        setSize();
        const focused = document.activeElement;
        returnFocus = focused instanceof HTMLElement && focused !== document.body ? focused : trigger;
        try {
          dialog.style.display = "grid";
          dialog.showModal();
        } catch {
          failed();
          return;
        }
        window.addEventListener("resize", setSize);
        if (config.frequency === "session") {
          openings = sessionOpenings() + 1;
          try { sessionStorage.setItem(sessionKey, String(openings)); } catch { /* Use the page-level value. */ }
        }
        frame.element.focus();
        frame.opened();
        animateOpening();
      }, failed);
      setSize();
      document.body.append(dialog);
      dialog.append(frame.element);
    }

    dialog.addEventListener("close", release);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    if (config.trigger === "delay") {
      setTimeout(open, Math.max(0, pageReadyTime + config.delayMs - Date.now()));
    } else if (config.triggerSelector) {
      try { document.querySelector(config.triggerSelector); } catch { return; }
      document.addEventListener("click", (event) => {
        const trigger = event.target instanceof Element && event.target.closest(config.triggerSelector);
        if (trigger instanceof HTMLElement) open(trigger);
      });
    }
  }

  async function start() {
    const pageReadyTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), loadTimeout);
    try {
      const response = await fetch(`${origin}/api/embed-config/${id}`, {
        credentials: "omit", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) return;
      const config = await response.json();
      if (!validConfig(config)) return;
      popup(config, pageReadyTime);
    } catch {
      // A blocked or unavailable widget leaves the host page usable.
    } finally {
      clearTimeout(timeout);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();
