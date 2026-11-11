export const popupStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { overflow: hidden; }

  .popup {
    position: relative;
    height: 100vh;
    height: 100dvh;
    color: var(--widget-on-surface);
    background: var(--widget-surface);
    font: 16px/1.55 "Segoe UI", system-ui, sans-serif;
    overflow-wrap: anywhere;
  }
  .popup-image-only { background: transparent; }

  .popup-scroll {
    height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .popup-media {
    display: block;
    width: 100%;
    height: auto;
  }
  .popup-image-only .popup-media {
    height: 100%;
    object-fit: contain;
  }

  .popup-content {
    padding: clamp(18px, 5vw, 40px);
  }
  .popup-content:first-child { padding-block-start: clamp(58px, 12vw, 68px); }
  .popup-content h1 {
    margin: 0;
    font-size: clamp(24px, 5vw, 40px);
    line-height: 1.15;
    letter-spacing: -.025em;
  }
  .popup-content p { margin: 10px 0 0; white-space: pre-line; }
  .popup-content p:first-child { margin-block-start: 0; }

  .popup-action {
    display: inline-flex;
    min-height: 44px;
    max-width: 100%;
    align-items: center;
    margin-block-start: 20px;
    padding: 8px 18px;
    border-radius: 7px;
    color: var(--widget-on-accent);
    background: var(--widget-accent);
    text-decoration: none;
    font-weight: 650;
  }
  .popup-action:first-child { margin-block-start: 0; }
  .popup-close {
    position: absolute;
    z-index: 1;
    inset-block-start: 8px;
    inset-inline-end: 8px;
    display: grid;
    width: 44px;
    height: 44px;
    padding: 0;
    place-items: center;
    border: 1px solid var(--widget-border);
    border-radius: 50%;
    color: var(--widget-on-surface);
    background: var(--widget-surface);
    cursor: pointer;
  }
  .popup-action:hover { text-decoration: underline; }
  .popup-close:hover { background: var(--widget-accent-soft); }
  .popup :focus-visible { outline: 3px solid var(--widget-focus); outline-offset: 2px; }
  .popup-scroll:focus-visible { outline-offset: -3px; }
`;
