/** Static browser code. The widget renderer authorizes this source by its CSP hash. */
export const feeCheckScript = String.raw`
(function () {
  "use strict";

  const root = document.getElementById("freedom-fee-check");
  if (!root) return;

  const find = (id) => root.querySelector("#fee-check-" + id);
  const form = find("form");
  const salesInput = find("sales");
  const countInput = find("count");
  const feesInput = find("fees");
  const warning = find("warning");
  const confirm = find("confirm");
  const salesNext = find("sales-next");
  const showResultButton = find("show-result");
  const panels = Array.from(root.querySelectorAll("[data-panel]"));
  const steps = Array.from(root.querySelectorAll("[data-progress-step]"));
  const stepNumbers = { statement: "1", sales: "2", fees: "3" };
  const previousPanel = { sales: "statement", fees: "sales", help: "statement", result: "fees" };
  const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const wholeNumber = new Intl.NumberFormat("en-US");
  const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
  const maximumCents = 100000000000;
  let activePanel = "statement";

  function readCents(value) {
    const text = value.trim().replace(/^\$\s*/, "");
    if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return null;
    const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return Number.isSafeInteger(cents) && cents <= maximumCents ? cents : null;
  }

  function readCount(value) {
    const text = value.trim();
    if (text === "") return undefined;
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
    const count = Number(text.replace(/,/g, ""));
    return Number.isSafeInteger(count) && count > 0 ? count : null;
  }

  function displayRate(fees, sales) {
    const rate = fees / sales;
    return rate > 0 && rate < 0.0001 ? "<0.01%" : percent.format(rate);
  }

  function salesError(sales) {
    return sales ? "" : "Enter a credit card sales total between $0.01 and $1,000,000,000.";
  }

  function countError(count, sales) {
    if (count === null) return "Enter a whole number of successful credit card transactions, or leave this blank.";
    if (sales && count > sales) {
      return "The average transaction is less than $0.01. Check the credit card sales total and count from the same statement, or leave the count blank.";
    }
    return "";
  }

  function feesError(fees) {
    return fees === null ? "Enter total processing fees between $0 and $1,000,000,000." : "";
  }

  function setFieldError(input, message) {
    const error = root.querySelector("#" + input.id + "-error");
    error.textContent = message;
    error.hidden = !message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function checkSales() {
    const sales = readCents(salesInput.value);
    const count = readCount(countInput.value);
    const salesMessage = salesError(sales);
    const countMessage = countError(count, sales);
    setFieldError(salesInput, salesMessage);
    setFieldError(countInput, countMessage);
    if (salesMessage || countMessage) {
      (salesMessage ? salesInput : countInput).focus();
      return null;
    }
    return { sales, count };
  }

  function clearWarning() {
    warning.hidden = true;
    find("warning-message").textContent = "";
    confirm.hidden = true;
    showResultButton.hidden = false;
  }

  function moveTo(next, focus = true) {
    activePanel = next;
    clearWarning();
    for (const panel of panels) panel.hidden = panel.dataset.panel !== next;
    salesNext.type = next === "sales" ? "submit" : "button";
    showResultButton.type = next === "fees" ? "submit" : "button";

    const currentStep = stepNumbers[next];
    find("progress").hidden = !currentStep;
    find("step-status").textContent = currentStep ? "Step " + currentStep + " of 3" : "";
    for (const step of steps) {
      if (step.dataset.progressStep === currentStep) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    }

    if (focus) {
      const heading = root.querySelector("[data-panel='" + next + "'] [data-panel-heading]");
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  function renderReview(sales, count) {
    find("review-sales").textContent = dollars.format(sales / 100);
    find("review-count-row").hidden = count === undefined;
    find("review-count").textContent = count === undefined ? "" : wholeNumber.format(count);
  }

  function renderResult(sales, count, fees, reviewed) {
    find("result-sales").textContent = dollars.format(sales / 100);
    find("result-fees").textContent = dollars.format(fees / 100);
    find("result-rate").textContent = displayRate(fees, sales);
    find("average-row").hidden = count === undefined;
    find("result-average").textContent = count === undefined ? "" : dollars.format(sales / count / 100);
    find("result-note").hidden = !reviewed;
    moveTo("result");
  }

  function reviewMessage(fees, sales) {
    const rate = displayRate(fees, sales);
    if (fees * 1000 < sales * 15) {
      return "The fees entered equal " + rate + " of credit card sales. Check that you included the full credit card processing fee total for the statement period.";
    }
    if (fees * 100 >= sales * 15) {
      return "The fees entered equal " + rate + " of credit card sales. Fixed fees or a low-sales month can raise this figure. Check that both amounts come from the same statement period.";
    }
    return "";
  }

  function completeFees(confirmed) {
    if (activePanel !== "fees") return;
    const sales = readCents(salesInput.value);
    const count = readCount(countInput.value);
    const fees = readCents(feesInput.value);
    const message = feesError(fees);
    setFieldError(feesInput, message);
    if (message) {
      clearWarning();
      feesInput.focus();
      return;
    }

    const review = reviewMessage(fees, sales);
    if (review && !confirmed) {
      find("warning-message").textContent = review;
      warning.hidden = false;
      confirm.hidden = false;
      showResultButton.hidden = true;
      confirm.focus();
      return;
    }
    renderResult(sales, count, fees, Boolean(review));
  }

  salesInput.addEventListener("input", () => {
    setFieldError(salesInput, "");
    setFieldError(countInput, "");
  });
  countInput.addEventListener("input", () => setFieldError(countInput, ""));
  feesInput.addEventListener("input", () => {
    setFieldError(feesInput, "");
    clearWarning();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activePanel === "sales") {
      const activity = checkSales();
      if (activity) {
        renderReview(activity.sales, activity.count);
        moveTo("fees");
      }
    } else {
      completeFees(false);
    }
  });
  confirm.addEventListener("click", () => {
    if (!confirm.hidden) completeFees(true);
  });
  root.addEventListener("click", (event) => {
    const action = event.target.closest("button[data-action]")?.dataset.action;
    if (action === "statement-yes") moveTo("sales");
    if (action === "statement-no") moveTo("help");
    if (action === "back" && previousPanel[activePanel]) moveTo(previousPanel[activePanel]);
    if (action === "restart") {
      form.reset();
      for (const input of [salesInput, countInput, feesInput]) setFieldError(input, "");
      moveTo("statement");
    }
  });

  moveTo("statement", false);
}());
`;
