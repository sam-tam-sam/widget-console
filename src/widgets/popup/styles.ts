export const popupStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; overflow: clip; }

  .popup {
    --popup-gap: clamp(4px, 1.5vh, 10px);
    --popup-close-size: 44px;
    height: 100vh;
    height: 100dvh;
    padding: clamp(4px, 1.3vh, 10px) clamp(4px, 1.6vw, 10px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--popup-gap);
    overflow: clip;
    color: var(--widget-on-surface);
    font: 16px/1.4 "Segoe UI", system-ui, sans-serif;
    overflow-wrap: anywhere;
  }

  .popup-close {
    justify-self: end;
    display: grid;
    place-items: center;
    inline-size: var(--popup-close-size);
    block-size: var(--popup-close-size);
    padding: 0;
    border: 1px solid #f2ad40;
    border-radius: 50%;
    color: #1f2431;
    background: #ffdb78;
    box-shadow: 0 3px 10px rgb(0 0 0 / .28);
    cursor: pointer;
  }

  .popup-stage {
    min-block-size: 0;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--popup-gap);
  }

  .popup-with-media .popup-stage { justify-content: stretch; }

  .popup-artwork {
    flex: 1 1 0;
    min-block-size: 0;
    inline-size: 100%;
    container-type: size;
    display: grid;
    place-items: center;
    overflow: clip;
  }

  .popup-media-link, .popup-media {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
  }

  .popup-media { object-fit: contain; }

  @supports (inline-size: 1cqh) {
    .popup-artwork > :is(.popup-media-link, .popup-media) {
      inline-size: min(100%, calc(100cqh * var(--popup-image-ratio)));
      block-size: auto;
      aspect-ratio: var(--popup-image-ratio);
    }
  }

  .popup-content {
    display: grid;
    justify-items: center;
    flex: 0 0 auto;
    inline-size: fit-content;
    min-inline-size: min(100%, 15rem);
    max-inline-size: min(100%, 32rem);
    padding: clamp(6px, 1.8vh, 16px) clamp(10px, 4vw, 22px);
    gap: clamp(3px, 1.25vh, 8px);
    border-radius: 12px;
    background: var(--widget-surface);
    text-align: center;
  }

  .popup-content:has(.popup-action:only-child) {
    min-inline-size: 0;
    padding: 0;
    background: transparent;
  }

  .popup-content h1, .popup-content p, .popup-action span {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    overflow: clip;
    overflow-wrap: anywhere;
  }

  .popup-content h1 {
    margin: 0;
    -webkit-line-clamp: 2;
    font-size: clamp(18px, 5.8vw, 30px);
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: -.025em;
    text-wrap: balance;
  }

  .popup-content p {
    margin: 0;
    -webkit-line-clamp: 5;
    font-size: clamp(13px, 3.4vw, 16px);
    white-space: pre-line;
  }

  .popup-with-media .popup-content p { -webkit-line-clamp: 3; }

  .popup-action {
    display: inline-grid;
    place-items: center;
    min-block-size: 44px;
    max-inline-size: 100%;
    padding: 6px clamp(14px, 5vw, 24px);
    border: 1px solid var(--widget-accent);
    border-radius: 999px;
    color: var(--widget-on-accent);
    background: var(--widget-accent);
    box-shadow: 0 2px 6px rgb(0 0 0 / .18);
    font-size: clamp(14px, 3.6vw, 16px);
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none;
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .popup-action span { -webkit-line-clamp: 2; }
  .popup :focus-visible { outline: 2px solid var(--widget-focus); outline-offset: 2px; }
  .popup-close:focus-visible { outline-color: #fff; }
  .popup-media-link:focus-visible { outline-color: #fff; outline-offset: -3px; }

  @media (hover: hover) {
    .popup-action:hover { transform: translateY(-2px); box-shadow: 0 5px 10px rgb(0 0 0 / .24); }
    .popup-close:hover { background: #ffe7a0; }
  }

  @media (max-height: 340px) {
    .popup-content h1, .popup-action span { -webkit-line-clamp: 1; }
    .popup-content h1 { font-size: clamp(16px, 5.8vw, 22px); }
    .popup-content p { -webkit-line-clamp: 2; }
    .popup-with-media .popup-content p { -webkit-line-clamp: 1; }
  }

  @media (max-height: 220px) {
    .popup-content { padding-block: 4px; }
    .popup-with-media .popup-content:has(h1, .popup-action) p {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      clip-path: inset(50%);
    }
  }

  @media (max-height: 185px) {
    .popup { --popup-close-size: 36px; }
    .popup-action { min-block-size: 36px; }
    .popup-content { padding-block: 3px; }
    .popup-content h1 { font-size: clamp(16px, 5.8vw, 20px); }
    .popup-content p { -webkit-line-clamp: 1; }
    .popup-content:has(h1, .popup-action) p,
    .popup-with-media .popup-content:has(.popup-action) h1 {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      clip-path: inset(50%);
    }
    .popup-with-media .popup-content:has(.popup-action) { padding: 0; background: transparent; }
  }

  @media (prefers-reduced-motion: reduce) {
    .popup-action { transition: none; }
    .popup-action:hover { transform: none; }
  }
`;
