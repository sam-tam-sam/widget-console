import logoAssets from "./assets/logos.json";

type ChannelRate = { percent: number; perTransaction: number };

export type CalculatorProvider = {
  id: string;
  name: string;
  logo?: string;
  rates?: { inPerson: ChannelRate; online: ChannelRate };
  source?: string;
  note?: string;
};

const localLogos: Record<string, { type: string; base64: string }> = logoAssets;

const catalog: readonly CalculatorProvider[] = [
  {
    id: "square",
    name: "Square",
    rates: {
      inPerson: { percent: 2.6, perTransaction: 0.15 },
      online: { percent: 3.3, perTransaction: 0.30 },
    },
    source: "https://squareup.com/us/en/pricing",
    note: "Square Free US pricing for domestic in-person cards and online or invoice card payments. Online API and other plans have different rates. Rates checked November 10, 2026.",
  },
  {
    id: "stripe",
    name: "Stripe",
    rates: {
      inPerson: { percent: 2.7, perTransaction: 0.05 },
      online: { percent: 2.9, perTransaction: 0.30 },
    },
    source: "https://stripe.com/pricing?locale=en-US",
    note: "Stripe Standard US domestic cards and base Terminal pricing. Tap to Pay, international cards, and other add-ons can cost more. Rates checked November 10, 2026.",
  },
  { id: "adyen", name: "Adyen" },
  { id: "elavon", name: "Elavon" },
  { id: "clover", name: "Clover" },
  { id: "global-payments", name: "Global Payments" },
  { id: "chase", name: "Chase" },
  { id: "heartland", name: "Heartland" },
  { id: "braintree", name: "Braintree" },
  { id: "quickbooks", name: "QuickBooks" },
  { id: "xero", name: "Xero" },
  { id: "wave", name: "Wave" },
  { id: "jane", name: "Jane" },
  { id: "simplepractice", name: "SimplePractice" },
  { id: "jobber", name: "Jobber" },
  { id: "lightspeed", name: "Lightspeed" },
  { id: "zoho", name: "Zoho" },
  { id: "boulevard", name: "Boulevard" },
  { id: "shopify", name: "Shopify Payments" },
  { id: "paypal", name: "PayPal" },
  { id: "toast", name: "Toast" },
  { id: "sumup", name: "SumUp" },
];

export const providers: readonly CalculatorProvider[] = catalog.map((provider) => {
  const asset = localLogos[provider.id];
  return asset ? { ...provider, logo: `data:${asset.type};base64,${asset.base64}` } : provider;
});
