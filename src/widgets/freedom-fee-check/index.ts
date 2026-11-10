import { widgetAppearanceCss } from "../appearance";
import type { WidgetAppearance, WidgetConfiguration, WidgetTemplate } from "../contracts";
import { escapeHtml, widgetDocument } from "../html";
import { feeCheckScript } from "./client";
import { defaultReviewLabel, feeCheckFields, parseFeeCheckSettings } from "./settings";
import { feeCheckStyles } from "./styles";

const title = "Fee Check";
const appearance: WidgetAppearance = {
  accent: "#4a2170",
  background: "#f8f6f2",
  surface: "#fffefa",
};

// Lucide icons are static markup in the standalone widget document.
function icon(shape: string) {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shape}</svg>`;
}

const statementIcon = icon('<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8"/>');
const helpIcon = icon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01"/>');
const arrowIcon = icon('<path d="M5 12h14m-7-7 7 7-7 7"/>');
const privacyIcon = icon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4"/>');

function panel(id: string, heading: string, intro: string, content: string) {
  return `<section data-panel="${id}" aria-labelledby="fee-check-${id}-heading" ${id === "statement" ? "" : "hidden"}>
    <h2 id="fee-check-${id}-heading" data-panel-heading tabindex="-1">${heading}</h2>
    <p class="fee-check-lead">${intro}</p>
    ${content}
  </section>`;
}

function choice(action: string, symbol: string, label: string, details: string) {
  return `<button class="fee-check-choice" type="button" data-action="${action}">
    <span class="fee-check-choice-icon">${symbol}</span>
    <span class="fee-check-choice-copy"><strong>${label}</strong><span>${details}</span></span>
    <span class="fee-check-choice-arrow">${arrowIcon}</span>
  </button>`;
}

function field(key: string, label: string, hint: string, money = true) {
  const id = `fee-check-${key}`;
  return `<div class="fee-check-field">
    <label for="${id}">${label}</label>
    <p class="fee-check-hint" id="${id}-hint">${hint}</p>
    <div class="fee-check-input">
      ${money ? '<span class="fee-check-prefix" aria-hidden="true">$</span>' : ""}
      <input type="text" id="${id}" inputmode="${money ? "decimal" : "numeric"}" maxlength="24" autocomplete="off" spellcheck="false" aria-describedby="${id}-hint ${id}-error" ${money ? "required" : ""}>
    </div>
    <p class="fee-check-error" id="${id}-error" role="alert" hidden></p>
  </div>`;
}

const start = panel("statement", "Do you have a monthly statement?", "Use one full month of credit card activity to calculate your processing costs.", `
  <div class="fee-check-choices">
    ${choice("statement-yes", statementIcon, "Yes, I have a statement", "Use the totals from that statement.")}
    ${choice("statement-no", helpIcon, "I need help finding it", "See which figures to look for.")}
  </div>`);

const sales = panel("sales", "How much did you sell by credit card?", "Use the totals for one full statement period.", `
  ${field("sales", "Total credit card sales (USD)", "Use successful credit card sales before refunds and processing fees.")}
  ${field("count", "Successful credit card transactions (optional)", "Use the count from the same statement period.", false)}
  <div class="fee-check-actions">
    <button class="fee-check-back" type="button" data-action="back">Back</button>
    <button class="fee-check-button" type="button" id="fee-check-sales-next">Continue ${arrowIcon}</button>
  </div>`);

const fees = panel("fees", "What did you pay in processing fees?", "Use credit card fees from the same statement period.", `
  <dl class="fee-check-review" aria-label="Your statement totals so far">
    <div><dt>Credit card sales</dt><dd id="fee-check-review-sales"></dd></div>
    <div id="fee-check-review-count-row" hidden><dt>Successful transactions</dt><dd id="fee-check-review-count"></dd></div>
  </dl>
  ${field("fees", "Total credit card processing fees (USD)", "Include transaction fees and monthly processing charges for those sales. Exclude equipment and unrelated charges.")}
  <section class="fee-check-warning" id="fee-check-warning" aria-labelledby="fee-check-warning-heading" hidden>
    <h3 id="fee-check-warning-heading">Double-check the statement totals</h3>
    <p id="fee-check-warning-message" role="status"></p>
    <button class="fee-check-button" type="button" id="fee-check-confirm" hidden>Confirm and show results</button>
  </section>
  <div class="fee-check-actions">
    <button class="fee-check-back" type="button" data-action="back">Back</button>
    <button class="fee-check-button" type="button" id="fee-check-show-result">Show my results ${arrowIcon}</button>
  </div>`);

function reviewLink(configuration: WidgetConfiguration) {
  if (typeof configuration.reviewUrl !== "string") return "";
  const label = typeof configuration.reviewLabel === "string" ? configuration.reviewLabel : defaultReviewLabel;
  return `<a class="fee-check-button" href="${escapeHtml(configuration.reviewUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function help(link: string) {
  return panel("help", "Find your processing totals", "Open your payment provider’s portal and choose a monthly processing statement.", `
    <ol class="fee-check-help-list">
      <li><strong>Pick one full month.</strong> Use the same statement period for sales and fees.</li>
      <li><strong>Find your credit card sales.</strong> Use the statement total for credit card sales.</li>
      <li><strong>Find your processing fees.</strong> Use the fees for those sales, including monthly processing charges.</li>
    </ol>
    <div class="fee-check-actions">
      <button class="fee-check-back" type="button" data-action="back">Back</button>
      ${link}
    </div>`);
}

function result(link: string) {
  return panel("result", "Your statement summary", "Here’s what credit card processing cost for the period you entered.", `
    <div class="fee-check-rate">
      <span>Effective processing rate</span>
      <strong id="fee-check-result-rate"></strong>
    </div>
    <dl class="fee-check-receipt">
      <div><dt>Credit card sales</dt><dd id="fee-check-result-sales"></dd></div>
      <div><dt>Processing fees</dt><dd id="fee-check-result-fees"></dd></div>
      <div id="fee-check-average-row" hidden><dt>Average transaction</dt><dd id="fee-check-result-average"></dd></div>
    </dl>
    <p class="fee-check-hint">The effective rate is processing fees divided by credit card sales, expressed as a percentage.</p>
    <p class="fee-check-hint" id="fee-check-result-note" hidden>One-time charges or a low-sales month can make this period different from a typical month.</p>
    <div class="fee-check-actions">
      <button class="fee-check-back" type="button" data-action="back">Edit entries</button>
      <button class="fee-check-back" type="button" data-action="restart">Start over</button>
      ${link}
    </div>`);
}

const rail = `<header class="fee-check-rail">
  <h1 class="fee-check-rail-title">${statementIcon}<span>${title}</span></h1>
  <ol id="fee-check-progress" aria-label="Progress">
    <li data-progress-step="1" aria-current="step"><span class="fee-check-step-number">1</span><span class="fee-check-step-label">Statement</span></li>
    <li data-progress-step="2"><span class="fee-check-step-number">2</span><span class="fee-check-step-label">Sales</span></li>
    <li data-progress-step="3"><span class="fee-check-step-number">3</span><span class="fee-check-step-label">Fees</span></li>
  </ol>
</header>`;

export const freedomFeeCheck: WidgetTemplate = {
  key: "freedom-fee-check",
  name: title,
  description: "Guide visitors through a monthly processing statement and show the effective fee rate.",
  appearance,
  configurationFields: feeCheckFields,
  embedHeight: 780,
  clientScript: feeCheckScript,
  parseConfiguration: parseFeeCheckSettings,
  render({ configuration }) {
    const link = reviewLink(configuration);
    const css = widgetAppearanceCss(appearance, configuration) + feeCheckStyles;
    return widgetDocument(title, css, `<main id="freedom-fee-check">
      <div class="fee-check-shell">
        ${rail}
        <div class="fee-check-paper">
          <p id="fee-check-step-status">Step 1 of 3</p>
          <noscript><p>Enable JavaScript to check your statement.</p></noscript>
          <form id="fee-check-form" novalidate>
            ${start}${sales}${fees}${help(link)}${result(link)}
          </form>
        </div>
      </div>
      <p class="fee-check-footer">${privacyIcon}<span>Your entries stay in this browser tab.</span></p>
    </main>`);
  },
};
