import { WidgetError, type WidgetConfiguration, type WidgetConfigurationField } from "../contracts";
import { optionalWidgetText, widgetHttpsUrl } from "../configuration";

type Rate = { percent: number; perTransaction: number };

export type ProposedPlan = {
  name: string;
  rates: { inPerson: Rate; online: Rate };
  monthlyFee: number;
  inPersonDebit: Rate | null;
};

const PLAN = "Proposed plan";
const DEBIT = "Optional in-person debit pricing";
const CONVERSION = "Conversion link";

export const calculatorFields: readonly WidgetConfigurationField[] = [
  { key: "planName", label: "Proposed plan name", control: "text", section: PLAN, description: "Optional. Defaults to Proposed plan." },
  { key: "inPersonPercent", label: "In-person rate (%)", control: "number", section: PLAN, description: "Enter all four channel pricing fields to calculate savings. Zero is allowed." },
  { key: "inPersonPerTransaction", label: "In-person fee per transaction ($)", control: "number", section: PLAN },
  { key: "onlinePercent", label: "Online rate (%)", control: "number", section: PLAN },
  { key: "onlinePerTransaction", label: "Online fee per transaction ($)", control: "number", section: PLAN },
  { key: "monthlyFee", label: "Monthly plan fee ($)", control: "number", section: PLAN, description: "Optional. Defaults to $0." },
  { key: "inPersonDebitPercent", label: "In-person debit rate (%)", control: "number", section: DEBIT, description: "Enter both debit fields to price the in-person debit share separately." },
  { key: "inPersonDebitPerTransaction", label: "In-person debit fee per transaction ($)", control: "number", section: DEBIT },
  { key: "ctaUrl", label: "Conversion URL", control: "url", section: CONVERSION, description: "Optional HTTPS destination for the button shown with results." },
  { key: "ctaLabel", label: "Conversion button label", control: "text", section: CONVERSION, description: "Optional. Defaults to Request a quote." },
];

const fieldLabels = new Map(calculatorFields.map(({ key, label }) => [key, label]));

function optionalPrice(input: unknown, key: string): string | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  if (typeof input !== "string" && typeof input !== "number") {
    throw new WidgetError(`Enter a number for ${fieldLabels.get(key)}.`);
  }

  const text = String(input).trim();
  if (!text) return undefined;
  const percent = key.endsWith("Percent");
  const max = percent ? 100 : key === "monthlyFee" ? 1_000_000 : 1_000;
  const precision = percent ? 4 : 2;
  const decimalPattern = new RegExp(`^(?:\\d+(?:\\.\\d{1,${precision}})?|\\.\\d{1,${precision}})$`);
  const value = Number(text);

  if (text.length > 32 || !decimalPattern.test(text) || !Number.isFinite(value) || value > max) {
    throw new WidgetError(`${fieldLabels.get(key)} must be between 0 and ${max.toLocaleString("en-US")} with up to ${precision} decimal places.`);
  }
  return String(value);
}

export function parseCalculatorSettings(input: unknown): WidgetConfiguration {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new WidgetError("Calculator settings must be an object.");
  }
  const value = input as Record<string, unknown>;
  const output: WidgetConfiguration = {};

  for (const { key, label, control } of calculatorFields) {
    const setting = control === "number"
      ? optionalPrice(value[key], key)
      : optionalWidgetText(value[key], label, control === "url" ? 2048 : 80);
    if (setting !== undefined) output[key] = control === "url" ? widgetHttpsUrl(setting, label) : setting;
  }
  return output;
}

function rate(configuration: WidgetConfiguration, prefix: string): Rate | null {
  const percent = configuration[`${prefix}Percent`];
  const perTransaction = configuration[`${prefix}PerTransaction`];
  if (typeof percent !== "string" || typeof perTransaction !== "string") return null;
  return { percent: Number(percent), perTransaction: Number(perTransaction) };
}

export function proposedPlan(configuration: WidgetConfiguration): ProposedPlan | null {
  const inPerson = rate(configuration, "inPerson");
  const online = rate(configuration, "online");
  if (!inPerson || !online) return null;

  return {
    name: typeof configuration.planName === "string" ? configuration.planName : PLAN,
    rates: { inPerson, online },
    monthlyFee: Number(configuration.monthlyFee ?? 0),
    inPersonDebit: rate(configuration, "inPersonDebit"),
  };
}
