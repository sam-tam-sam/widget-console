/** Reviewed, dependency-free browser script attached with its exact CSP hash. */
export const calculatorScript = String.raw`
(function () {
  "use strict";
  const root = document.getElementById("processing-fee-calculator");
  if (!root) return;
  const find = (id) => root.querySelector("#" + id);
  const text = (id, value) => {
    const node = find(id);
    if (!node) return;
    node.textContent = value;
    if (id === "form-error" || id === "cost-error") node.hidden = !value;
  };
  const form = find("calculator-form");
  const volumeInput = find("monthly-volume");
  const transactionInput = find("monthly-transactions");
  const inPersonInput = find("in-person-percent");
  const onlineInput = find("online-percent");
  const debitInput = find("debit-percent");
  const results = find("calculator-results");
  const dialog = find("cost-dialog");
  const costForm = find("cost-form");
  const nameInput = find("provider-name");
  const costInput = find("monthly-cost");
  const warning = find("cost-warning");
  const cards = Array.from(root.querySelectorAll("[data-provider]"));
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const percentages = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const savedCosts = new Map();
  let selectedId = "flat-rate";
  let pendingId = null;
  let data;

  try {
    data = JSON.parse(root.dataset.config || "{}");
    if (!Array.isArray(data.providers)) throw new Error("Invalid provider configuration.");
  } catch {
    text("form-error", "The calculator is unavailable. Refresh and try again.");
    return;
  }

  form.noValidate = true;
  costForm.noValidate = true;

  function readMoney(value) {
    const normalized = value.trim().replace(/^\$\s*/, "");
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(normalized)) return null;
    const parts = normalized.replace(/,/g, "").split(".");
    const cents = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
    return Number.isSafeInteger(cents) && cents <= 100000000000 ? cents : null;
  }

  function readCount(value) {
    const normalized = value.trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(normalized)) return null;
    const count = Number(normalized.replace(/,/g, ""));
    return Number.isSafeInteger(count) && count > 0 && count <= 100000000 ? count : null;
  }

  function readPercent(value) {
    const normalized = value.trim().replace(/%$/, "").trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const number = Number(normalized);
    return number <= 100 ? number : null;
  }

  function readActivity() {
    const volume = readMoney(volumeInput.value);
    const transactions = readCount(transactionInput.value);
    const inPerson = readPercent(inPersonInput.value);
    const online = readPercent(onlineInput.value);
    const debit = debitInput && data.proposedPlan?.inPersonDebit ? readPercent(debitInput.value) : 0;

    if (!volume) {
      return reportError("form-error", "Enter a monthly card volume between $0.01 and $1,000,000,000.", volumeInput);
    }
    if (transactions === null) {
      return reportError("form-error", "Enter a whole transaction count between 1 and 100,000,000.", transactionInput);
    }
    if (inPerson === null) {
      return reportError("form-error", "Enter an in-person share between 0% and 100%.", inPersonInput);
    }
    if (online === null || Math.abs(inPerson + online - 100) > 0.00001) {
      return reportError("form-error", "The in-person and online shares must add up to 100%.", onlineInput);
    }
    if (debit === null) {
      return reportError("form-error", "Enter an in-person debit share between 0% and 100%.", debitInput);
    }
    return { volume, transactions, inPerson: inPerson / 100, debit: debit / 100 };
  }

  function reportError(id, message, field) {
    text(id, message);
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
    return null;
  }

  function changeShare(input, complement) {
    const share = readPercent(input.value);
    if (share !== null) {
      complement.value = String(Number((100 - share).toFixed(2)));
      complement.removeAttribute("aria-invalid");
    }
  }

  function hideResults() {
    results.hidden = true;
    text("form-error", "");
  }

  function displayCost(cents) {
    return currency.format(cents / 100);
  }

  function monthlyCost(activity, rates, monthlyFee, debitRate) {
    // Four decimal places on a rate percentage and two on a share
    // percentage. Keep the weighted fee in fractional cents until the end.
    const rateScale = 1000000n;
    const shareScale = 10000n;
    const inPerson = BigInt(Math.round(activity.inPerson * Number(shareScale)));
    const debit = BigInt(Math.round(activity.debit * Number(shareScale)));
    const feeAtRate = (rate) => (
      BigInt(activity.volume) * BigInt(Math.round(rate.percent * 10000)) +
      BigInt(activity.transactions) * BigInt(Math.round(rate.perTransaction * 100)) * rateScale
    );
    const standardInPerson = feeAtRate(rates.inPerson);
    const cardPresent = debitRate
      ? standardInPerson * (shareScale - debit) + feeAtRate(debitRate) * debit
      : standardInPerson * shareScale;
    const weighted = cardPresent * inPerson + feeAtRate(rates.online) * (shareScale - inPerson) * shareScale;
    const divisor = rateScale * shareScale * shareScale;
    return Number((weighted + divisor / 2n) / divisor) + Math.round((monthlyFee || 0) * 100);
  }

  function findProvider(id) {
    return data.providers.find((provider) => provider.id === id);
  }

  function showSource(id, provider) {
    const link = find(id);
    if (!link) return;
    link.hidden = true;
    link.removeAttribute("href");
    if (!provider || !provider.source) return;
    try {
      const url = new URL(provider.source);
      if (url.protocol !== "https:" || url.username || url.password) return;
      link.href = url.href;
      link.textContent = provider.name + " published pricing";
      link.hidden = false;
    } catch {
      // Invalid source URLs are omitted.
    }
  }

  function selectProvider(id) {
    selectedId = id;
    for (const card of cards) card.setAttribute("aria-pressed", String(card.dataset.provider === id));
    const provider = findProvider(id);
    const statement = savedCosts.get(id);
    if (statement) {
      text("provider-note", statement.name + ": " + displayCost(statement.cents) + " per month from your statement. Select the card again to edit.");
    } else {
      text("provider-note", provider?.note || "");
    }
    showSource("provider-source", statement ? null : provider);
    hideResults();
  }

  function updateWarning() {
    const volume = readMoney(volumeInput.value);
    const cents = readMoney(costInput.value);
    warning.hidden = !(volume && cents !== null && cents / volume < 0.015);
  }

  function openStatementDialog(id) {
    const provider = findProvider(id);
    const saved = savedCosts.get(id);
    pendingId = id;
    nameInput.value = saved?.name || provider?.name || "";
    costInput.value = saved ? (saved.cents / 100).toFixed(2) : "";
    nameInput.removeAttribute("aria-invalid");
    costInput.removeAttribute("aria-invalid");
    text("cost-error", "");
    updateWarning();
    dialog.showModal();
    if (nameInput.value) costInput.focus();
    else nameInput.focus();
  }

  for (const card of cards) {
    card.addEventListener("click", () => {
      const id = card.dataset.provider;
      if (findProvider(id)?.rates) selectProvider(id);
      else openStatementDialog(id);
    });
  }

  find("close-cost-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (!dialog.open) pendingId = null;
  });
  for (const input of [nameInput, costInput]) {
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      text("cost-error", "");
      updateWarning();
    });
  }
  costForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (pendingId === null) return;
    const name = nameInput.value.trim();
    const cents = readMoney(costInput.value);
    if (!name || name.length > 100) {
      reportError("cost-error", "Enter a provider name of up to 100 characters.", nameInput);
      return;
    }
    if (cents === null) {
      reportError("cost-error", "Enter the full monthly cost as a valid dollar amount.", costInput);
      return;
    }
    savedCosts.set(pendingId, { name, cents });
    selectProvider(pendingId);
    dialog.close();
  });

  const more = find("more-providers");
  const extra = find("extra-providers");
  if (more && extra) {
    more.addEventListener("click", () => {
      const expanded = extra.hidden;
      extra.hidden = !expanded;
      more.setAttribute("aria-expanded", String(expanded));
      text("more-providers-label", expanded ? "See fewer providers" : "See more providers");
    });
  }

  for (const input of [volumeInput, transactionInput, inPersonInput, onlineInput, debitInput]) {
    if (!input) continue;
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      if (input === inPersonInput) changeShare(inPersonInput, onlineInput);
      if (input === onlineInput) changeShare(onlineInput, inPersonInput);
      hideResults();
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    hideResults();
    const activity = readActivity();
    if (!activity) return;
    const provider = findProvider(selectedId);
    const statement = savedCosts.get(selectedId);
    const current = statement
      ? statement.cents
      : provider?.rates ? monthlyCost(activity, provider.rates, 0, null) : null;
    if (current === null) {
      reportError("form-error", "Choose a provider or enter the costs from your statement.");
      return;
    }

    const plan = data.proposedPlan;
    const name = statement?.name || provider.name;
    const effective = percentages.format(current * 100 / activity.volume);
    text("result-current-label", name + " monthly cost");
    text("result-current-cost", displayCost(current));
    text("result-current-effective", effective + "%");
    showSource("result-source", statement ? null : provider);

    const projection = find("result-projection");
    projection.hidden = !plan;
    const missing = find("result-plan-missing");
    if (missing) missing.hidden = Boolean(plan);

    const notes = [];
    if (statement) {
      notes.push("Current costs use the full monthly statement amount you entered.");
      if (current / activity.volume < 0.015) {
        notes.push("The effective rate is below 1.5%. Double-check that you entered all fees for the same month.");
      }
    } else if (provider.note) {
      notes.push(provider.note);
    }

    if (plan) {
      const proposed = monthlyCost(activity, plan.rates, plan.monthlyFee, plan.inPersonDebit);
      const difference = current - proposed;
      text("result-proposed-label", plan.name + " estimated monthly cost");
      text("result-proposed-cost", displayCost(proposed));
      const differenceSign = difference > 0 ? "+" : "";
      text("result-monthly-difference", differenceSign + displayCost(difference));
      text("result-annual-difference", differenceSign + displayCost(difference * 12));
      text("result-difference-label", difference > 0 ? "Estimated savings" : "Estimated difference");
      if (difference < 0) notes.push("A negative difference means the proposed plan costs more.");
      if (difference === 0) notes.push("Both monthly costs are equal under these inputs.");
      notes.push("Annual figures assume 12 months with the same activity.");
    } else if (!missing) {
      notes.push("Proposed rates have not been configured for this calculator.");
    }

    if (plan || !statement) {
      notes.push("Estimates apply the same channel mix to volume and transaction counts and round monthly totals to cents.");
      if (plan?.inPersonDebit) notes.push("The debit share applies to the proposed in-person rate only.");
      notes.push("Actual fees may differ by plan and statement charges.");
    }
    text("result-note", notes.join(" "));
    results.hidden = false;
    results.focus({ preventScroll: true });
    results.scrollIntoView({ block: "nearest" });
  });

  selectProvider(selectedId);
})();
`;
