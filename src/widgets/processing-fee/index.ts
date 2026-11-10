import { widgetAppearanceCss } from "../appearance";
import type { WidgetAppearance, WidgetTemplate } from "../contracts";
import { escapeHtml, widgetDocument } from "../html";
import { calculatorScript } from "./client";
import { providers, type CalculatorProvider } from "./providers";
import { calculatorFields, parseCalculatorSettings, proposedPlan } from "./settings";
import { calculatorStyles } from "./styles";

const title = "Processing Fee Calculator";
const appearance: WidgetAppearance = {
  accent: "#26269e",
  background: "#ffffff",
  surface: "#ffffff",
};

/*! Lucide x, triangle-exclamation-point, and chevron-down path data.
 * ISC License. Copyright (c) 2026 Lucide Icons and Contributors.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 */
function lucideIcon(paths: readonly string[]): string {
  const nodes = paths.map((path) => `<path d="${path}"/>`).join("");
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes}</svg>`;
}

const chevron = lucideIcon(["m6 9 6 6 6-6"]);
const close = lucideIcon(["M18 6 6 18", "m6 6 12 12"]);
const warning = lucideIcon([
  "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
  "M12 9v4",
  "M12 17h.01",
]);

const illustrativeRate: CalculatorProvider = {
  id: "flat-rate",
  name: "Default Flat-Rate",
  rates: {
    inPerson: { percent: 2.9, perTransaction: 0.30 },
    online: { percent: 2.9, perTransaction: 0.30 },
  },
  note: "Illustrative rate: 2.9% + $0.30 per transaction. Use your statement for a more accurate comparison.",
};

function providerButton(provider: CalculatorProvider) {
  const name = escapeHtml(provider.name);
  const logo = provider.logo && /^data:image\/(?:svg\+xml|png|jpeg|webp);base64,/.test(provider.logo)
    ? `<img src="${escapeHtml(provider.logo)}" alt="" decoding="async">`
    : name;
  return `<button type="button" class="fee-provider" data-provider="${escapeHtml(provider.id)}" aria-label="${name}" aria-pressed="${provider.id === illustrativeRate.id}">${logo}</button>`;
}

function providerPanel() {
  const primary = providers.slice(0, 18).map(providerButton).join("");
  const additional = providers.slice(18).map(providerButton).join("");
  return `<section class="fee-provider-panel" aria-labelledby="fee-providers-heading">
    <h2 id="fee-providers-heading">Compare your current processor</h2>
    <div class="fee-providers-inner">
      <div class="fee-provider-grid" role="group" aria-label="Processing providers">
        ${providerButton(illustrativeRate)}${primary}
        <button type="button" class="fee-provider" data-provider="custom" aria-pressed="false"><span id="custom-provider-label">Enter Custom</span></button>
      </div>
      <div class="fee-provider-grid" id="extra-providers" role="group" aria-label="More processing providers" hidden>${additional}</div>
      <div class="fee-provider-footer">
        <div class="fee-provider-context" aria-live="polite">
          <p id="provider-note">${escapeHtml(illustrativeRate.note ?? "")}</p>
          <a id="provider-source" target="_blank" rel="noopener noreferrer" hidden>Pricing source</a>
        </div>
        <button type="button" class="fee-more-button" id="more-providers" aria-controls="extra-providers" aria-expanded="false" ${additional ? "" : "hidden"}>
          <span id="more-providers-label">See more providers</span> ${chevron}
        </button>
      </div>
    </div>
  </section>`;
}

const calculationInputs = `<div class="fee-top">
  <div class="fee-field">
    <label for="monthly-volume">Monthly credit &amp; debit card volume</label>
    <div class="fee-input-box">
      <span class="fee-currency-sign" aria-hidden="true">$</span>
      <input id="monthly-volume" type="text" inputmode="decimal" autocomplete="off" value="50,000" maxlength="26" aria-describedby="monthly-volume-unit">
      <span id="monthly-volume-unit" class="fee-currency-chip">USD</span>
    </div>
  </div>
  <div class="fee-field">
    <label for="monthly-transactions">Transactions</label>
    <div class="fee-input-box"><input id="monthly-transactions" type="text" inputmode="numeric" autocomplete="off" value="6,250" maxlength="18"></div>
  </div>
  <fieldset class="fee-split-group">
    <legend class="fee-split-legend">Where do you accept payments?</legend>
    <div class="fee-split-inputs">
      <div class="fee-split-cell"><input id="in-person-percent" type="text" inputmode="decimal" autocomplete="off" value="100" maxlength="6" aria-label="In-person percentage"><span class="fee-percent-sign" aria-hidden="true">%</span></div>
      <div class="fee-split-cell"><input id="online-percent" type="text" inputmode="decimal" autocomplete="off" value="0" maxlength="6" aria-label="Online percentage"><span class="fee-percent-sign" aria-hidden="true">%</span></div>
    </div>
    <div class="fee-split-labels" aria-hidden="true"><span>In-person</span><span>Online</span></div>
  </fieldset>
</div>`;

function cardTypes(debitRateAvailable: boolean) {
  return `<details class="fee-card-types">
    <summary>Customize card types ${chevron}</summary>
    <div class="fee-card-fields">
      <label for="debit-percent">In-person debit share (%)</label>
      <input id="debit-percent" type="text" inputmode="decimal" autocomplete="off" value="0" maxlength="6" aria-describedby="debit-hint">
      <p id="debit-hint">${debitRateAvailable
        ? "The debit share applies to in-person volume and transactions for the proposed plan. The remainder uses the standard in-person rate."
        : "The proposed plan uses the same in-person rate for debit and credit until separate debit pricing is configured."}</p>
    </div>
  </details>`;
}

const costDialog = `<dialog id="cost-dialog" class="fee-dialog" aria-labelledby="cost-dialog-title">
  <div class="fee-dialog-header">
    <h2 id="cost-dialog-title">Your Current Monthly Costs</h2>
    <button type="button" id="close-cost-dialog" class="fee-dialog-close" aria-label="Close" data-close-dialog>${close}</button>
  </div>
  <form id="cost-form" novalidate>
    <div class="fee-dialog-field">
      <label for="provider-name">Name of Provider</label>
      <input id="provider-name" type="text" maxlength="100" autocomplete="off">
    </div>
    <div class="fee-dialog-field">
      <label for="monthly-cost">Enter your current total monthly cost: (all fees)</label>
      <div class="fee-dialog-amount"><span aria-hidden="true">$</span><input id="monthly-cost" type="text" inputmode="decimal" autocomplete="off" maxlength="26"></div>
    </div>
    <div id="cost-warning" class="fee-warning" role="status" hidden>
      ${warning}
      <p>An effective rate below 1.5% is unusually low. Check your statement and enter <strong>all processing fees for the full month</strong>. Include percentage charges, per-transaction fees, monthly fees, and any other charges your provider billed.</p>
    </div>
    <p id="cost-error" class="fee-error" role="alert" hidden></p>
    <button type="submit" id="set-costs" class="fee-primary">Set Costs</button>
  </form>
</dialog>`;

function results(conversionUrl?: string, conversionLabel?: string) {
  const conversion = conversionUrl
    ? `<a class="fee-primary" id="result-cta" href="${escapeHtml(conversionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(conversionLabel || "Request a quote")}</a>`
    : "";

  return `<section id="calculator-results" class="fee-results" aria-labelledby="calculator-results-title" tabindex="-1" hidden>
    <h2 id="calculator-results-title">Estimated processing costs</h2>
    <dl class="fee-results-grid">
      <div class="fee-result-box"><dt id="result-current-label">Current monthly cost</dt><dd id="result-current-cost"></dd></div>
      <div class="fee-result-box"><dt>Current effective rate</dt><dd id="result-current-effective"></dd></div>
    </dl>
    <dl id="result-projection" class="fee-projection" hidden>
      <div class="fee-result-box"><dt id="result-proposed-label">Proposed monthly cost</dt><dd id="result-proposed-cost"></dd></div>
      <div class="fee-result-box"><dt id="result-difference-label">Estimated monthly difference</dt><dd id="result-monthly-difference"></dd></div>
      <div class="fee-result-box"><dt>Estimated annual difference</dt><dd id="result-annual-difference"></dd></div>
    </dl>
    <p id="result-plan-missing" class="fee-small-print" hidden>Proposed plan pricing is unavailable. Confirm a written quote before comparing costs.</p>
    <div class="fee-result-foot"><p id="result-note"></p><a id="result-source" target="_blank" rel="noopener noreferrer" hidden>Pricing source</a></div>
    ${conversion}
  </section>`;
}

export const processingFeeCalculator: WidgetTemplate = {
  key: "processing-fee-calculator",
  name: title,
  description: "Compare monthly card processing costs and link visitors to your quote page.",
  appearance,
  configurationFields: calculatorFields,
  embedHeight: 960,
  clientScript: calculatorScript,
  parseConfiguration: parseCalculatorSettings,
  render({ configuration }) {
    const plan = proposedPlan(configuration);
    const clientProviders = [illustrativeRate, ...providers].map(({ id, name, rates, source, note }) => ({ id, name, rates, source, note }));
    const config = escapeHtml(JSON.stringify({ providers: clientProviders, proposedPlan: plan }));
    const conversionUrl = typeof configuration.ctaUrl === "string" ? configuration.ctaUrl : undefined;
    const conversionLabel = typeof configuration.ctaLabel === "string" ? configuration.ctaLabel : undefined;

    const css = widgetAppearanceCss(appearance, configuration) + calculatorStyles;
    return widgetDocument(title, css, `<main id="processing-fee-calculator" data-config="${config}">
      <h1 class="fee-sr-only">${title}</h1>
      <form id="calculator-form" novalidate>
        ${calculationInputs}
        ${cardTypes(Boolean(plan?.inPersonDebit))}
        ${providerPanel()}
        <p id="form-error" class="fee-error" role="alert" hidden></p>
        <button type="submit" class="fee-primary" id="calculate-button">Calculate savings</button>
      </form>
      ${costDialog}
      ${results(conversionUrl, conversionLabel)}
      <p class="fee-small-print">Estimates are for comparison only. Actual fees depend on your agreement, card mix, and provider charges. Confirm pricing in writing before switching.</p>
    </main>`);
  },
};
