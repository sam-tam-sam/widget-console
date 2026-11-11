import type { WidgetInstance, WidgetTemplate } from "../contracts";
import { escapeHtml, widgetDocument } from "../html";
import { parsePopupSettings, popupFields, popupSize } from "./settings";
import { popupStyles } from "./styles";

const name = "Popup";
const closeIcon = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const closeButton = `<button class="popup-close" type="button" data-widget-close aria-label="Close popup">${closeIcon}</button>`;

function renderPopup({ configuration, image }: WidgetInstance) {
  if (!image) {
    return widgetDocument(name, popupStyles, `
      <main class="popup" aria-label="Popup">
        <div class="popup-empty">
          ${closeButton}
          <p>Choose an image in Settings.</p>
        </div>
      </main>`);
  }

  const { ctaUrl, imageAlt } = configuration;
  const alt = typeof imageAlt === "string" ? escapeHtml(imageAlt) : "";
  const imageMarkup = `<img class="popup-media" src="${escapeHtml(image.src)}" alt="${alt}" width="${image.width}" height="${image.height}">`;
  const media = typeof ctaUrl === "string"
    ? `<a class="popup-media-link" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer"${alt ? "" : ' aria-label="Open image link"'}>${imageMarkup}</a>`
    : imageMarkup;

  return widgetDocument(name, popupStyles, `
    <main class="popup" aria-label="Popup">
      <div class="popup-artwork" style="--popup-image-ratio: ${image.width / image.height}">
        ${closeButton}
        ${media}
      </div>
    </main>`);
}

export const popup: WidgetTemplate = {
  key: "popup",
  name,
  description: "Show an image over the host page, on a timer or from a button.",
  configurationFields: popupFields,
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
