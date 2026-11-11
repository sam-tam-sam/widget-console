import { widgetAppearanceCss } from "../appearance";
import type { WidgetAppearance, WidgetInstance, WidgetTemplate } from "../contracts";
import { escapeHtml, widgetDocument } from "../html";
import { announcementFields, announcementTime, parseAnnouncementSettings } from "./settings";
import { announcementStyles } from "./styles";

const name = "Announcement Bar";
const appearance: WidgetAppearance = { accent: "#18436f", surface: "#e9f2fc" };

const iconShapes = {
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/>',
  megaphone: '<path d="m3 11 16-6v14L3 14v-3Zm4 4 2 5h3l-2-4m12-5v3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

function icon(shape: string) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}

function renderAnnouncement({ configuration }: WidgetInstance) {
  const { message, ctaLabel, ctaUrl, dismissible, icon: selectedIcon } = configuration;
  const messageText = typeof message === "string" ? message : "Welcome!";
  const messageIcon = selectedIcon === "info" || selectedIcon === "calendar" || selectedIcon === "megaphone"
    ? icon(iconShapes[selectedIcon])
    : "";
  const link = typeof ctaUrl === "string"
    ? `<a class="announcement-action" dir="auto" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(typeof ctaLabel === "string" ? ctaLabel : "Learn more")}</a>`
    : "";

  return widgetDocument(name, widgetAppearanceCss(appearance, configuration) + announcementStyles, `
    <section class="announcement" aria-label="Announcement" data-widget-content>
      <div class="announcement-content">
        <div class="announcement-main">
          <div class="announcement-message" dir="auto">${messageIcon}<p>${escapeHtml(messageText)}</p></div>
          ${link}
        </div>
        ${dismissible === "no" ? "" : `<button class="announcement-close" type="button" data-widget-close aria-label="Close announcement">${icon(iconShapes.close)}</button>`}
      </div>
    </section>`);
}

export const announcementBar: WidgetTemplate = {
  key: "announcement",
  name,
  description: "Place a scheduled announcement above the host page header.",
  configurationFields: announcementFields,
  appearance,
  embedHeights: { compact: 240, mobile: 240, wide: 240 },
  hostEmbed: "announcement",
  parseConfiguration: parseAnnouncementSettings,
  render: renderAnnouncement,
  resolveHostEmbed({ configuration }) {
    const { mountSelector, fixedHeaderSelector, startsAt, endsAt } = configuration;
    return {
      kind: "announcement",
      mountSelector: typeof mountSelector === "string" ? mountSelector : "#widget-announcement",
      fixedHeaderSelector: typeof fixedHeaderSelector === "string" ? fixedHeaderSelector : "",
      startsAt: announcementTime(startsAt),
      endsAt: announcementTime(endsAt),
    };
  },
};
