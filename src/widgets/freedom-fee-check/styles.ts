export const feeCheckStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }

  #freedom-fee-check {
    --error: #a82d38;
    --amber: #805119;
    max-width: 944px;
    margin: 0 auto;
    padding: clamp(16px, 4vw, 36px) clamp(12px, 4vw, 32px) 20px;
    color: var(--widget-on-surface);
    font: 16px/1.55 Nunito, "Segoe UI", system-ui, sans-serif;
  }

  .fee-check-shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--widget-border);
    border-radius: 18px;
    box-shadow: 0 12px 35px #3420400d;
  }

  .fee-check-rail {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 24px;
    padding: 28px 24px;
    color: var(--widget-on-accent);
    background: var(--widget-accent);
  }

  .fee-check-rail-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 28px;
    font-weight: 760;
    line-height: 1.08;
    letter-spacing: -.035em;
  }
  .fee-check-rail-title svg { flex: 0 0 24px; }

  #fee-check-progress {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 17px 0 0;
    border-top: 1px solid color-mix(in srgb, currentColor 32%, transparent);
    list-style: none;
  }

  [data-progress-step] {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 8px;
    font-size: 14px;
  }

  .fee-check-step-number {
    display: grid;
    flex: 0 0 26px;
    width: 26px;
    height: 26px;
    place-items: center;
    border: 1px solid color-mix(in srgb, currentColor 60%, transparent);
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .fee-check-step-label { overflow-wrap: anywhere; }
  [data-progress-step][aria-current="step"] { outline: 1px solid currentColor; font-weight: 700; }
  [aria-current="step"] .fee-check-step-number { border-color: var(--widget-on-accent); color: var(--widget-accent); background: var(--widget-on-accent); }

  .fee-check-paper {
    min-width: 0;
    min-height: 397px;
    padding: clamp(24px, 5vw, 44px);
    background: var(--widget-surface);
  }

  #fee-check-step-status {
    margin: 0 0 9px;
    color: var(--widget-accent-ink);
    font-size: 13px;
    font-weight: 750;
  }
  #fee-check-step-status:empty { display: none; }

  [data-panel] { min-width: 0; }

  [data-panel-heading] {
    max-width: 25ch;
    margin: 0 0 10px;
    font-size: clamp(27px, 4vw, 38px);
    font-weight: 770;
    line-height: 1.12;
    letter-spacing: -.038em;
    text-wrap: balance;
  }

  .fee-check-lead {
    max-width: 55ch;
    margin: 0 0 21px;
  }

  .fee-check-choices { display: grid; gap: 10px; }

  .fee-check-choice {
    display: grid;
    width: 100%;
    min-height: 66px;
    grid-template-columns: 38px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 12px;
    padding: 11px 13px;
    border: 1px solid var(--widget-border);
    border-radius: 12px;
    color: var(--widget-on-surface);
    background: var(--widget-surface);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .fee-check-choice:hover { border-color: var(--widget-focus); }

  .fee-check-choice-icon {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: 8px;
    color: var(--widget-on-accent-soft);
    background: var(--widget-accent-soft);
  }

  .fee-check-choice-icon svg { width: 19px; height: 19px; }
  .fee-check-choice-copy strong, .fee-check-choice-copy span { display: block; }
  .fee-check-choice-copy strong { font-size: 16px; line-height: 1.3; }
  .fee-check-choice-copy span { margin-top: 3px; font-size: 14px; line-height: 1.35; }
  .fee-check-choice-arrow { display: grid; width: 18px; height: 18px; place-items: center; color: var(--widget-accent-ink); }
  .fee-check-choice-arrow svg { width: 17px; height: 17px; }

  .fee-check-field { margin: 16px 0; }
  .fee-check-field label { display: block; margin-bottom: 5px; font-weight: 740; }
  .fee-check-hint { margin: 5px 0 7px; font-size: 14px; line-height: 1.45; }

  .fee-check-input {
    display: flex;
    width: min(100%, 330px);
    min-height: 49px;
    align-items: stretch;
    overflow: hidden;
    border: 1px solid var(--widget-border);
    border-radius: 9px;
    background: var(--widget-surface);
  }

  .fee-check-prefix {
    display: grid;
    min-width: 42px;
    place-items: center;
    border-right: 1px solid var(--widget-border);
    color: var(--widget-on-accent-soft);
    background: var(--widget-accent-soft);
    font-weight: 740;
  }

  .fee-check-input input {
    width: 100%;
    min-width: 0;
    min-height: 47px;
    padding: 8px 12px;
    border: 0;
    color: var(--widget-on-surface);
    background: transparent;
    font: inherit;
    font-size: 17px;
    font-variant-numeric: tabular-nums;
  }

  .fee-check-input:has(input[aria-invalid="true"]) { border-color: var(--error); }
  .fee-check-input:focus-within { outline: 2px solid var(--widget-focus); outline-offset: 2px; }
  .fee-check-input input:focus { outline: none; }
  .fee-check-error { margin: 8px 0 0; padding: 7px 10px; border-radius: 6px; color: var(--error); background: #fff1f1; font-size: 14px; font-weight: 650; }

  .fee-check-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: 20px;
  }

  .fee-check-button, .fee-check-back {
    display: inline-flex;
    min-height: 46px;
    max-width: 100%;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 15px;
    border: 1px solid transparent;
    border-radius: 9px;
    font: inherit;
    font-weight: 720;
    line-height: 1.3;
    text-align: center;
    text-decoration: none;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .fee-check-button { color: var(--widget-on-accent); background: var(--widget-accent); }
  .fee-check-button:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--widget-focus) 55%, transparent); }
  .fee-check-back { border-color: var(--widget-border); color: var(--widget-accent-ink); background: transparent; }
  .fee-check-back:hover { border-color: var(--widget-focus); }
  .fee-check-button svg, .fee-check-back svg { flex: 0 0 16px; width: 16px; height: 16px; }

  #freedom-fee-check :is(button, a, [tabindex]):focus-visible {
    outline: 2px solid var(--widget-focus);
    outline-offset: 3px;
  }

  .fee-check-warning {
    margin: 18px 0 0;
    padding: 14px 15px;
    border: 1px solid #e7c692;
    border-left: 4px solid #aa6c27;
    border-radius: 9px;
    color: var(--amber);
    background: #fff6e5;
  }

  .fee-check-warning h3 { margin: 0 0 4px; font-size: 16px; line-height: 1.35; }
  .fee-check-warning p { margin: 0; font-size: 14px; }
  .fee-check-warning .fee-check-button { margin-top: 10px; }
  #fee-check-confirm:focus-visible { outline-color: var(--amber); }

  .fee-check-review, .fee-check-receipt { margin: 16px 0 0; padding: 0; }

  .fee-check-review {
    padding: 4px 12px;
    border: 1px solid var(--widget-border);
    border-radius: 9px;
    color: var(--widget-on-accent-soft);
    background: var(--widget-accent-soft);
  }

  .fee-check-review > div, .fee-check-receipt > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 6px 14px;
    padding: 8px 0;
    font-size: 14px;
  }

  .fee-check-review > div + div, .fee-check-receipt > div + div { border-top: 1px dashed var(--widget-border); }
  .fee-check-review dd, .fee-check-receipt dd {
    margin: 0;
    font-weight: 730;
    text-align: right;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .fee-check-rate {
    display: grid;
    gap: 5px;
    margin: 0;
    padding: 15px 17px;
    border-left: 4px solid var(--widget-focus);
    border-radius: 0 10px 10px 0;
    color: var(--widget-on-accent-soft);
    background: var(--widget-accent-soft);
  }

  .fee-check-rate span { font-size: 14px; font-weight: 700; }
  .fee-check-rate strong {
    font-size: clamp(31px, 6vw, 48px);
    line-height: 1.08;
    letter-spacing: -.04em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .fee-check-receipt { border-block: 1px dashed var(--widget-border); }
  .fee-check-help-list { margin: 0; padding-left: 23px; }
  .fee-check-help-list li + li { margin-top: 6px; }
  .fee-check-help-list li::marker { color: var(--widget-accent-ink); font-weight: 750; }

  .fee-check-footer {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin: 20px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--widget-border);
    color: var(--widget-on-surface);
    font-size: 13px;
    line-height: 1.4;
  }

  .fee-check-footer svg { flex: 0 0 16px; width: 16px; height: 16px; margin-top: 2px; }

  @media (max-width: 780px) {
    .fee-check-shell { grid-template-columns: minmax(0, 1fr); border-radius: 14px; }
    .fee-check-rail { gap: 10px; padding: 15px 18px 12px; }
    .fee-check-rail-title { font-size: 23px; }
    .fee-check-rail-title svg { flex-basis: 20px; width: 20px; height: 20px; }
    #fee-check-progress {
      width: min(100%, 420px);
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3px;
      padding: 3px;
      border: 0;
      border-radius: 10px;
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    [data-progress-step] { justify-content: center; gap: 5px; padding: 5px 2px; font-size: 12px; line-height: 1.2; }
    [data-progress-step][aria-current="step"] { outline: 0; background: color-mix(in srgb, currentColor 18%, transparent); }
    .fee-check-step-number { flex-basis: 18px; width: 18px; height: 18px; font-size: 10px; }
    .fee-check-paper { min-height: 0; padding: 22px 18px 18px; }
  }

  @media (max-width: 480px) {
    #freedom-fee-check { padding: 8px 8px 12px; }
    .fee-check-rail { padding: 14px 14px 10px; }
    .fee-check-paper { padding: 18px 16px 15px; }
    #fee-check-step-status { margin-bottom: 6px; }
    [data-panel-heading] { margin-bottom: 8px; font-size: clamp(24px, 6.4vw, 29px); line-height: 1.16; }
    .fee-check-lead { margin-bottom: 16px; }
    .fee-check-choice { grid-template-columns: 32px minmax(0, 1fr) 16px; gap: 8px; padding: 10px; }
    .fee-check-choice-icon { width: 32px; height: 32px; }
    .fee-check-field { margin: 14px 0; }
    .fee-check-field label { margin-bottom: 2px; line-height: 1.3; }
    .fee-check-hint { margin-top: 4px; }
    .fee-check-input { width: 100%; }
    .fee-check-prefix { min-width: 36px; }
    .fee-check-actions { gap: 8px; margin-top: 16px; }
    .fee-check-actions > .fee-check-button { flex: 1 1 160px; }
    .fee-check-warning .fee-check-button { width: 100%; }
    .fee-check-footer { margin-top: 16px; padding-top: 10px; }
  }

  @media (max-width: 345px) {
    [data-progress-step] { gap: 3px; font-size: 11px; }
    .fee-check-review > div, .fee-check-receipt > div { grid-template-columns: minmax(0, 1fr); }
    .fee-check-review dd, .fee-check-receipt dd { text-align: left; }
  }
`;
