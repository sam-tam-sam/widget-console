import { widgetAppearanceCss } from "../appearance";
import type { WidgetAppearance, WidgetInstance, WidgetTemplate } from "../contracts";
import { escapeHtml, widgetDocument } from "../html";
import { parsePopupSettings, popupFields, popupSize } from "./settings";
import { popupStyles } from "./styles";

const name = "Popup";
const appearance: WidgetAppearance = { accent: "#124b5c", surface: "#ffffff" };
const closeIcon = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function renderPopup({ configuration, image }: WidgetInstance) {
  const { ctaLabel, ctaUrl, description, imageAlt, title } = configuration;
  const heading = typeof title === "string" ? title : !image && !description && !ctaUrl ? name : "";
  const media = image
    ? `<img class="popup-media" src="${escapeHtml(image.src)}" alt="${escapeHtml(typeof imageAlt === "string" ? imageAlt : "")}" width="${image.width}" height="${image.height}">`
    : "";
  const copy = [
    heading ? `<h1 id="popup-title" dir="auto">${escapeHtml(heading)}</h1>` : "",
    typeof description === "string" ? `<p dir="auto">${escapeHtml(description)}</p>` : "",
    typeof ctaUrl === "string"
      ? `<a class="popup-action" dir="auto" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(typeof ctaLabel === "string" ? ctaLabel : "Learn more")}</a>`
      : "",
  ].join("");

  return widgetDocument(name, widgetAppearanceCss(appearance, configuration) + popupStyles, `
    <main class="popup${copy ? "" : " popup-image-only"}" ${heading ? 'aria-labelledby="popup-title"' : 'aria-label="Popup"'}>
      <button class="popup-close" type="button" data-widget-close aria-label="Close popup">${closeIcon}</button>
      <div class="popup-scroll"${copy ? ' tabindex="0" role="region" aria-label="Popup content"' : ""}>
        ${media}
        ${copy ? `<div class="popup-content">${copy}</div>` : ""}
      </div>
    </main>`);
}

export const popup: WidgetTemplate = {
  key: "popup",
  name,
  description: "Show an image or offer over the host page, on a timer or from a button.",
  configurationFields: popupFields,
  appearance,
  embedHeights: { compact: 380, mobile: 380, wide: 380 },
  hostEmbed: "popup",
  imageUpload: true,
  parseConfiguration: parsePopupSettings,
  render: renderPopup,
  resolveHostEmbed(instance) {
    const { trigger, delaySeconds, triggerSelector, frequency, sessionLimit } = instance.configuration;
    return {
      kind: "popup",
      trigger: trigger === "click" ? "click" : "delay",
      delayMs: (typeof delaySeconds === "number" ? delaySeconds : 2) * 1000,
      triggerSelector: typeof triggerSelector === "string" ? triggerSelector : "#widget-popup-trigger",
      frequency: frequency === "always" ? "always" : "session",
      sessionLimit: typeof sessionLimit === "number" ? sessionLimit : 1,
      sizes: {
        phone: popupSize(instance, "phone"),
        tablet: popupSize(instance, "tablet"),
        medium: popupSize(instance, "medium"),
        desktop: popupSize(instance, "desktop"),
      },
    };
  },
};
