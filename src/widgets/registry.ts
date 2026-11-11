import type { WidgetTemplate } from "./contracts";
import { announcementBar } from "./announcement";
import { freedomFeeCheck } from "./freedom-fee-check";
import { popup } from "./popup";
import { processingFeeCalculator } from "./processing-fee";

const productTemplates: readonly WidgetTemplate[] = [freedomFeeCheck, processingFeeCalculator, popup, announcementBar];

export function registeredTemplates(): readonly WidgetTemplate[] {
  return productTemplates;
}
