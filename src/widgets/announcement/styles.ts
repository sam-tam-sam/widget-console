export const announcementStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }

  .announcement {
    color: var(--widget-on-surface);
    background: var(--widget-surface);
    font: 15px/1.45 "Segoe UI", system-ui, sans-serif;
    overflow-wrap: anywhere;
  }
  .announcement-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 58px;
    max-width: 1240px;
    margin-inline: auto;
    padding: 8px clamp(12px, 3vw, 26px);
  }
  .announcement-main {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px 14px;
  }
  .announcement-message {
    display: flex;
    min-width: 0;
    align-items: start;
    gap: 8px;
  }
  .announcement-message svg {
    flex: none;
    margin-block-start: 2px;
    color: var(--widget-accent-ink);
  }
  .announcement-message p { margin: 0; }
  .announcement-action, .announcement-close {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
  }
  .announcement-action {
    justify-content: center;
    max-width: 100%;
    padding: 6px 14px;
    border-radius: 7px;
    color: var(--widget-on-accent);
    background: var(--widget-accent);
    font-weight: 650;
    text-decoration: none;
  }
  .announcement-action:hover { text-decoration: underline; }
  .announcement-close {
    width: 44px;
    flex: 0 0 44px;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 7px;
    color: var(--widget-on-surface);
    background: transparent;
    cursor: pointer;
  }
  .announcement-close:hover { background: var(--widget-accent-soft); }
  .announcement :focus-visible { outline: 3px solid var(--widget-focus); outline-offset: 2px; }
  @media (max-width: 440px) {
    .announcement-content { align-items: start; }
    .announcement-main { justify-content: start; }
    .announcement-message { padding-block-start: 9px; }
  }
`;
