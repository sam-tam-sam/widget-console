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
  const registry = window[registryKey] ??= { installed: new Set(), fixedSlots: new Map(), activePopup: null };
  if (registry.installed.has(key)) return;
  registry.installed.add(key);

  const loadTimeout = 10_000;
  const maxSize = 4096;
  const profiles = [
    ["phone", 600], ["tablet", 900], ["medium", 1200], ["desktop", Infinity],
  ];
  const integerBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const validSelector = (value) => typeof value === "string" && value.length <= 300;
  const validTimestamp = (value) => value === null || Number.isSafeInteger(value);

  function validConfig(config) {
    if (!config || typeof config !== "object") return false;
    if (config.kind === "popup") {
      return (config.trigger === "delay" || config.trigger === "click") &&
        integerBetween(config.delayMs, 0, 3_600_000) &&
        validSelector(config.triggerSelector) &&
        (config.frequency === "always" || config.frequency === "session") &&
        integerBetween(config.sessionLimit, 1, 20) &&
        profiles.every(([profile]) => {
          const size = config.sizes?.[profile];
          return integerBetween(size?.width, 1, maxSize) && integerBetween(size?.height, 1, maxSize) &&
            (size.scale === undefined || integerBetween(size.scale, 10, 100));
        });
    }
    return config.kind === "announcement" &&
      validSelector(config.mountSelector) &&
      validSelector(config.fixedHeaderSelector) &&
      validTimestamp(config.startsAt) &&
      validTimestamp(config.endsAt) &&
      (config.startsAt === null || config.endsAt === null || config.startsAt < config.endsAt);
  }

  function select(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
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
      if ((data.type === "ready" || data.type === "close") && fields === 3) onMessage(data);
      if (data.type === "resize" && fields === 4 && integerBetween(data.height, 1, 2400)) onMessage(data);
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
        return integerBetween(stored, 0, 20) ? Math.max(openings, stored) : openings;
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
      // Animate separately from the saved scale so the panel can resize while it opens.
      frame.element.animate?.([
        { opacity: 0, translate: "0 12px" },
        { opacity: 1, translate: "0 0" },
      ], { duration: 240, easing: "cubic-bezier(.2, .72, .26, 1)" });
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

  function offsetFixedHeader(slot, header) {
    if (typeof ResizeObserver !== "function") return;
    const existing = registry.fixedSlots.get(slot);
    if (existing) {
      if (existing.header !== header) return;
      existing.users++;
      return existing.release;
    }
    if ([...registry.fixedSlots.values()].some((entry) => entry.header === header)) return;

    const slotProperties = { position: "sticky", top: "0px", "z-index": "2147483646" };
    let originalSlot;
    let originalTop = header.style.getPropertyValue("top");
    let originalPriority = header.style.getPropertyPriority("top");
    let appliedTop;

    function pinSlot() {
      if (originalSlot) return;
      originalSlot = Object.keys(slotProperties).map((name) =>
        [name, slot.style.getPropertyValue(name), slot.style.getPropertyPriority(name)]
      );
      for (const [name, value] of Object.entries(slotProperties)) slot.style.setProperty(name, value);
    }

    function unpinSlot() {
      if (!originalSlot) return;
      for (const [name, value, priority] of originalSlot) {
        if (slot.style.getPropertyValue(name) === slotProperties[name] && !slot.style.getPropertyPriority(name)) {
          slot.style.setProperty(name, value, priority);
        }
      }
      originalSlot = undefined;
    }

    function restoreTop() {
      if (appliedTop === undefined) return;
      if (header.style.getPropertyValue("top") === appliedTop && header.style.getPropertyPriority("top") === "important") {
        header.style.setProperty("top", originalTop, originalPriority);
      }
      appliedTop = undefined;
    }

    function offset() {
      restoreTop();
      const computed = getComputedStyle(header);
      const top = Number.parseFloat(computed.top);
      if (computed.position !== "fixed" || !Number.isFinite(top)) {
        unpinSlot();
        return;
      }
      pinSlot();
      originalTop = header.style.getPropertyValue("top");
      originalPriority = header.style.getPropertyPriority("top");
      const height = slot.getBoundingClientRect().height;
      header.style.setProperty("top", `${top + height}px`, "important");
      appliedTop = header.style.getPropertyValue("top");
    }

    const observer = new ResizeObserver(offset);
    observer.observe(slot);
    window.addEventListener("resize", offset);
    const state = {
      header,
      users: 1,
      release() {
        state.users--;
        if (state.users > 0) return;
        observer.disconnect();
        window.removeEventListener("resize", offset);
        restoreTop();
        unpinSlot();
        registry.fixedSlots.delete(slot);
      },
    };
    registry.fixedSlots.set(slot, state);
    offset();
    return state.release;
  }

  function announcement(config) {
    const slot = select(config.mountSelector);
    if (!(slot instanceof HTMLElement) || slot === document.body || !document.body.contains(slot)) return;
    let container;
    let frame;
    let restoreHeader;
    let timer;
    let dismissed = false;

    function inWindow(now) {
      return (config.startsAt === null || now >= config.startsAt) &&
        (config.endsAt === null || now < config.endsAt);
    }

    function unmount() {
      frame?.remove();
      frame = undefined;
      container?.remove();
      container = undefined;
      restoreHeader?.();
      restoreHeader = undefined;
    }

    function mount() {
      container = document.createElement("div");
      container.style.overflow = "hidden";
      let ready = false;
      let height = 0;
      let visible = false;
      frame = widgetFrame("Announcement", (message) => {
        if (message.type === "close" && visible) stop();
        if (message.type === "ready") ready = true;
        if (message.type === "resize") height = message.height;
        if (!frame || !ready || !height) return;
        if (!inWindow(Date.now())) {
          update();
          return;
        }
        frame.element.style.height = `${height}px`;
        if (visible) return;
        visible = true;
        frame.ready();
        frame.element.style.visibility = "visible";
        const header = select(config.fixedHeaderSelector);
        if (header instanceof HTMLElement && header !== slot && !slot.contains(header) && !header.contains(slot)) {
          restoreHeader = offsetFixedHeader(slot, header);
        }
        frame.opened();
      }, stop);
      Object.assign(frame.element.style, { width: "100%", height: "0", visibility: "hidden" });
      container.append(frame.element);
      slot.append(container);
    }

    function stop() {
      dismissed = true;
      unmount();
      clearTimeout(timer);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
    }

    function update() {
      clearTimeout(timer);
      const now = Date.now();
      if (inWindow(now)) {
        if (!dismissed && !container && slot.isConnected) mount();
      } else {
        unmount();
      }
      if (dismissed) return;
      const boundary = [config.startsAt, config.endsAt].find((time) => time !== null && time > now);
      if (boundary !== undefined) timer = setTimeout(update, Math.min(boundary - now, 2_147_483_647));
    }

    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    update();
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
      if (config.kind === "popup") popup(config, pageReadyTime);
      else announcement(config);
    } catch {
      // A blocked or unavailable widget leaves the host page usable.
    } finally {
      clearTimeout(timeout);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();
