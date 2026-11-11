export const popupStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { overflow: hidden; overflow: clip; }

  .popup {
    --popup-close-size: min(44px, 32vh);
    --popup-close-gap: 4px;
    --popup-close-space: calc(var(--popup-close-size) + var(--popup-close-gap) + 4px);
    display: grid;
    place-items: center;
    height: 100vh;
    height: 100dvh;
    overflow: clip;
  }

  .popup-artwork {
    position: relative;
    container-type: size;
    margin-top: var(--popup-close-space);
    width: min(100%, calc((100vh - var(--popup-close-space)) * var(--popup-image-ratio)));
    width: min(100%, calc((100dvh - var(--popup-close-space)) * var(--popup-image-ratio)));
    aspect-ratio: var(--popup-image-ratio);
  }

  .popup-media-link, .popup-media {
    display: block;
    width: 100%;
    height: 100%;
  }

  .popup-media { object-fit: contain; }

  .popup-close {
    position: absolute;
    z-index: 1;
    top: 8px;
    right: 8px;
    top: min(8px, 5cqw, 5cqh);
    right: min(8px, 5cqw, 5cqh);
    display: grid;
    place-items: center;
    width: 44px;
    width: min(44px, 90cqw, 90cqh);
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid rgb(0 0 0 / .35);
    border-radius: 50%;
    background: #fff;
    color: #000;
    cursor: pointer;
  }

  .popup-close svg { width: min(21px, 55%); height: auto; }

  .popup-artwork > .popup-close {
    top: auto;
    bottom: calc(100% + var(--popup-close-gap));
    width: var(--popup-close-size);
    width: min(var(--popup-close-size), 90cqw, 90cqh);
  }

  .popup-close:focus-visible, .popup-media-link:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .popup-media-link:focus-visible { outline-offset: -3px; }

  .popup-empty {
    position: relative;
    container-type: size;
    display: grid;
    place-items: center;
    width: min(100%, 20rem);
    height: min(100%, 10rem);
    padding: 2.75rem 1rem .75rem;
    border-radius: 8px;
    background: #fff;
    color: #242424;
    font: 14px/1.4 system-ui, sans-serif;
    text-align: center;
  }

  .popup-empty p { margin: 0; }
  .popup-empty .popup-close:focus-visible { outline-color: #242424; }

  @media (hover: hover) {
    .popup-close:hover { background: #f3f4f6; }
  }
`;
