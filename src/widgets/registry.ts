import type { WidgetTemplate } from "./contracts";
import { freedomFeeCheck } from "./freedom-fee-check";
import { processingFeeCalculator } from "./processing-fee";

const productTemplates: readonly WidgetTemplate[] = [freedomFeeCheck, processingFeeCalculator];

export function registeredTemplates(): readonly WidgetTemplate[] {
  return productTemplates;
}
