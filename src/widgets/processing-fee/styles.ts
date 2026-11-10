export const calculatorStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--widget-background); }
  #processing-fee-calculator {
    --fee-focus: var(--widget-on-background);
    color: var(--widget-on-background);
    font: 16px/1.45 Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
    max-width: 1092px;
    margin: 0 auto;
    padding: 20px 24px 24px;
  }
  .fee-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  .fee-top {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, .75fr) minmax(0, 1fr);
    gap: clamp(16px, 3.85vw, 40px);
    align-items: start;
  }
  .fee-field, .fee-split-group { min-width: 0; }
  .fee-split-group { border: 0; margin: 0; padding: 0; }
  .fee-field label, .fee-split-legend { display: block; margin-bottom: 10px; font-size: clamp(15px, 1.8vw, 19px); font-weight: 400; }
  .fee-input-box, .fee-split-inputs {
    min-height: 73px;
    color: var(--widget-on-surface);
    background: var(--widget-surface);
    border: 2px solid var(--widget-border);
    border-radius: 16px;
  }
  .fee-input-box { display: flex; align-items: center; gap: 3px; padding: 0 18px; }
  .fee-input-box:focus-within, .fee-split-cell:focus-within { outline: 2px solid var(--fee-focus); outline-offset: 2px; }
  .fee-input-box input, .fee-split-cell input {
    font: inherit;
    color: inherit;
    font-size: clamp(23px, 3vw, 29px);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    letter-spacing: -.025em;
    border: 0;
    background: transparent;
    padding: 0;
    outline: 0;
    width: 100%;
    min-width: 0;
  }
  .fee-currency-sign, .fee-percent-sign { font-size: 24px; font-weight: 700; }
  .fee-currency-chip {
    flex: 0 0 auto;
    border: 1px solid var(--widget-border);
    border-radius: 10px;
    padding: 7px 11px;
    font-size: 13px;
    font-weight: 650;
  }
  .fee-split-inputs, .fee-split-labels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fee-split-cell { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 9px; }
  .fee-split-cell:first-child { border-right: 1px solid var(--widget-border); border-radius: 13px 0 0 13px; }
  .fee-split-cell:last-child { border-radius: 0 13px 13px 0; }
  .fee-split-cell input { width: 3.25ch; text-align: center; }
  .fee-split-labels { margin-top: 5px; text-align: center; }
  .fee-card-types { margin: -9px 0 30px; }
  .fee-card-types summary, .fee-more-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: inherit;
    font-size: 16px;
    font-weight: 650;
    cursor: pointer;
  }
  .fee-card-types summary::-webkit-details-marker { display: none; }
  .fee-card-types summary svg, .fee-more-button svg { width: 16px; height: 16px; }
  .fee-card-types[open] summary svg, .fee-more-button[aria-expanded="true"] svg { transform: rotate(180deg); }
  .fee-card-fields {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-top: 10px;
    padding: 12px 14px;
    --fee-focus: var(--widget-on-accent-soft);
    border: 1px solid var(--widget-border);
    border-radius: 12px;
    color: var(--widget-on-accent-soft);
    background: var(--widget-accent-soft);
  }
  .fee-card-fields label { font-weight: 600; }
  .fee-card-fields input { width: 82px; padding: 6px 8px; border: 1px solid var(--widget-border); border-radius: 8px; color: var(--widget-on-surface); background: var(--widget-surface); font: inherit; }
  .fee-card-fields p { flex: 1 1 240px; margin: 0; font-size: 14px; }
  .fee-provider-panel, .fee-results {
    --fee-focus: var(--widget-on-accent-soft);
    color: var(--widget-on-accent-soft);
    background: var(--widget-accent-soft);
  }
  .fee-provider-panel { padding: 30px 30px 26px; border-radius: 22px; }
  .fee-provider-panel h2 { margin: 0 0 39px; text-align: center; font-size: 22px; line-height: 1.2; font-weight: 700; letter-spacing: -.035em; }
  .fee-providers-inner { max-width: 864px; margin: 0 auto; }
  .fee-provider-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .fee-provider-grid + .fee-provider-grid { margin-top: 10px; }
  .fee-provider {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 60px;
    padding: 9px 12px;
    border: 2px solid transparent;
    border-radius: 16px;
    color: var(--widget-on-surface);
    background: var(--widget-surface);
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.22;
    text-align: center;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .fee-provider:has(img), .fee-provider[aria-pressed="true"]:has(img) { background: #fff; }
  .fee-provider img { display: block; width: 100%; height: 30px; max-width: 146px; object-fit: contain; }
  .fee-provider:hover { border-color: var(--widget-on-accent-soft); }
  .fee-provider[aria-pressed="true"] { background: var(--widget-accent); border-color: var(--widget-on-accent-soft); color: var(--widget-on-accent); }
  .fee-provider[data-provider="flat-rate"] { font-weight: 650; }
  .fee-provider[data-provider="custom"] { border-style: dashed; border-color: var(--widget-border); }
  .fee-provider[data-provider="custom"][aria-pressed="true"] { border-style: solid; border-color: var(--widget-on-accent-soft); }
  .fee-provider-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 16px; margin-top: 12px; }
  .fee-provider-context { flex: 1 1 360px; font-size: 13px; }
  .fee-provider-context p { margin: 0; display: inline; }
  .fee-provider-context a, #result-source { margin-inline-start: .4em; color: inherit; }
  .fee-more-button { margin-left: auto; border: 0; background: none; padding: 6px 0; font-family: inherit; }
  .fee-primary {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 55px;
    padding: 12px 18px;
    border: 0;
    border-radius: 15px;
    background: var(--widget-accent);
    color: var(--widget-on-accent);
    font: inherit;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }
  .fee-primary:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--fee-focus) 55%, transparent); }
  .fee-primary:disabled { opacity: .64; cursor: not-allowed; }
  #calculate-button { min-height: 60px; margin-top: 18px; font-size: 18px; }
  #processing-fee-calculator:has(#cost-dialog[open]) #calculate-button { opacity: .65; }
  .fee-error { color: #8b1a24; background: #fff1f1; padding: 10px 13px; margin: 12px 0 0; border-radius: 8px; font-size: 14px; }
  .fee-dialog {
    --fee-focus: var(--widget-focus);
    color: var(--widget-on-surface);
    width: min(560px, calc(100% - 28px));
    max-height: calc(100% - 24px);
    border: 1px solid var(--widget-border);
    border-radius: 21px;
    padding: 34px 39px 29px;
    background: var(--widget-surface);
    box-shadow: 0 18px 46px #18314f35;
  }
  .fee-dialog::backdrop { background: #0004; }
  #processing-fee-calculator:has(.fee-dialog[open]) .fee-provider-panel > * { filter: blur(6px); }
  .fee-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 22px; }
  .fee-dialog-header h2 { margin: 0; font-size: 20px; letter-spacing: -.025em; line-height: 1.2; }
  .fee-dialog-close { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid transparent; border-radius: 8px; color: inherit; background: transparent; cursor: pointer; flex: 0 0 auto; }
  .fee-dialog-close:hover { border-color: var(--widget-border); }
  .fee-dialog-close svg { width: 20px; height: 20px; }
  .fee-dialog-field + .fee-dialog-field { margin-top: 20px; }
  .fee-dialog-field label { display: block; margin-bottom: 5px; font-size: 17px; font-weight: 500; }
  .fee-dialog-field input {
    width: 100%;
    min-height: 46px;
    border: 1px solid var(--widget-border);
    border-radius: 10px;
    padding: 9px 12px;
    color: inherit;
    background: var(--widget-surface);
    font: inherit;
  }
  .fee-dialog-amount { position: relative; }
  .fee-dialog-amount span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-weight: 650; }
  .fee-dialog-amount input { padding-left: 35px; }
  .fee-warning { display: flex; align-items: start; gap: 10px; border: 1px solid #ffda69; border-radius: 11px; background: #fff9e9; color: #8f420c; padding: 12px 16px; margin-top: 14px; font-size: 14px; }
  .fee-warning svg { width: 21px; height: 21px; flex: 0 0 auto; margin-top: 3px; }
  .fee-warning p { margin: 0; }
  #set-costs { margin-top: 20px; min-height: 50px; font-size: 18px; }
  .fee-results { margin-top: 20px; padding: 22px; border: 1px solid var(--widget-border); border-radius: 17px; }
  .fee-results h2 { margin: 0 0 14px; font-size: 22px; letter-spacing: -.025em; }
  .fee-results-grid, .fee-projection { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
  .fee-projection { margin-top: 10px; }
  .fee-result-box { border-radius: 11px; border: 1px solid var(--widget-border); color: var(--widget-on-surface); background: var(--widget-surface); padding: 12px 14px; overflow-wrap: anywhere; }
  .fee-result-box dt { font-size: 14px; }
  .fee-result-box dd { margin: 0; font-size: 22px; font-weight: 740; font-variant-numeric: tabular-nums; }
  .fee-result-foot { margin: 12px 0 0; font-size: 13px; }
  #result-note { display: inline; }
  #result-cta { margin-top: 15px; width: auto; }
  .fee-small-print { margin: 10px 0 0; font-size: 13px; }
  #processing-fee-calculator :focus-visible { outline: 2px solid var(--fee-focus); outline-offset: 2px; }
  .fee-input-box input:focus-visible, .fee-split-cell input:focus-visible { outline: 0 !important; }
  @media (min-width: 801px) and (min-height: 700px) {
    .fee-dialog { transform: translateY(-38px); }
  }
  @media (max-width: 800px) {
    .fee-top { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
    .fee-split-group { grid-column: 1 / -1; }
    .fee-input-box, .fee-split-inputs { min-height: 61px; }
    .fee-provider-panel { padding: 22px 18px 17px; }
    .fee-provider-panel h2 { margin-bottom: 18px; }
    .fee-card-types { margin: 12px 0 19px; }
  }
  @media (max-width: 590px) {
    #processing-fee-calculator { padding: 12px; }
    .fee-field label, .fee-split-legend { font-size: 14px; line-height: 1.3; }
    .fee-field label { min-height: 2.6em; display: flex; align-items: end; }
    .fee-input-box { padding: 0 10px; }
    .fee-currency-chip { font-size: 11px; padding: 4px 5px; }
    .fee-currency-sign, .fee-percent-sign { font-size: 18px; }
    .fee-input-box input, .fee-split-cell input { font-size: clamp(17px, 5.4vw, 24px); }
    .fee-provider-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .fee-provider { min-height: 52px; font-size: 14px; border-radius: 12px; }
    .fee-provider img { height: 26px; max-width: 115px; }
    .fee-provider-panel { padding: 19px 10px 15px; border-radius: 16px; }
    .fee-provider-panel h2 { font-size: 18px; }
    .fee-dialog { padding: 19px 16px; }
    .fee-dialog-header { margin-bottom: 12px; }
    .fee-results { padding: 13px; }
    .fee-result-box { padding: 9px; }
    .fee-result-box dd { font-size: 17px; }
  }
  @media (max-width: 340px) {
    .fee-top { grid-template-columns: minmax(0, 1fr); }
    .fee-field label { min-height: 0; }
  }
`;
