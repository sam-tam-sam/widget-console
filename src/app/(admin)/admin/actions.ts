"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publishAdminChange } from "@/lib/admin-live";
import { isAdminMutation, requireAdmin } from "@/lib/auth";
import {
  createInstance,
  createLink,
  deleteInstance,
  getInstance,
  listTemplates,
  updateInstance,
  updateLink,
  updateWidgetOrigins,
  WidgetError,
} from "@/lib/widgets";
import type { WidgetConfiguration } from "@/widgets/contracts";
import { widgetAppearanceFields, widgetAppearanceInputName } from "@/widgets/appearance";
import { widgetEmbedHeightInputName, widgetEmbedProfiles } from "@/widgets/embed-size";

export type FormResult = { message?: string; error?: boolean };

type Change = {
  instanceId: string;
  message?: string;
  destination?: string;
};

function field(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

function advancedConfiguration(text: string): WidgetConfiguration {
  if (text.length > 16_384) throw new WidgetError("Configuration is too large.");

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new WidgetError("Enter configuration as a valid JSON object.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WidgetError("Enter configuration as a JSON object.");
  }
  return value as WidgetConfiguration;
}

function configuration(
  data: FormData,
  templateKey: string,
  previous?: WidgetConfiguration,
) {
  const template = listTemplates().find(({ key }) => key === templateKey);
  const fields = (template?.configurationFields ?? [])
    .filter(({ key }) => data.has(`config.${key}`));
  const colors = template?.appearance
    ? widgetAppearanceFields.filter(({ key }) => data.has(widgetAppearanceInputName(key)))
    : [];
  const text = fields.length ? "" : field(data, "configuration").trim();
  if (!text && !fields.length && !colors.length) return undefined;

  const value = { ...previous };
  if (text) {
    const { appearance, embedHeights } = value;
    const settings = advancedConfiguration(text);
    delete settings.appearance;
    delete settings.embedHeights;
    if (appearance !== undefined) settings.appearance = appearance;
    if (embedHeights !== undefined) settings.embedHeights = embedHeights;
    if (JSON.stringify(settings).length > 16_384) throw new WidgetError("Configuration is too large.");
    return settings;
  }
  for (const { key, label } of fields) {
    const entry = data.get(`config.${key}`);
    if (typeof entry !== "string") throw new WidgetError(`Enter text for ${label}.`);
    value[key] = entry;
  }

  if (colors.length) {
    const current = value.appearance;
    const appearance = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
    for (const { key, label } of colors) {
      const entry = data.get(widgetAppearanceInputName(key));
      if (typeof entry !== "string") throw new WidgetError(`Enter a color for ${label}.`);
      appearance[key] = entry;
    }
    value.appearance = appearance;
  }

  if (JSON.stringify(value).length > 16_384) throw new WidgetError("Configuration is too large.");
  return value;
}

function widgetPath(id: string) {
  return `/admin/widgets/${encodeURIComponent(id)}`;
}

async function submit(operation: () => Change): Promise<FormResult> {
  await requireAdmin();
  if (!await isAdminMutation()) return { error: true, message: "Open the administration address and try again." };
  let change: Change;
  try {
    change = operation();
  } catch (error) {
    if (error instanceof WidgetError) return { error: true, message: error.message };
    console.error("Dashboard mutation failed", error);
    return { error: true, message: "The change could not be saved. Try again." };
  }
  revalidatePath("/admin");
  revalidatePath(widgetPath(change.instanceId));
  publishAdminChange("widgets", change.instanceId);
  if (change.destination) redirect(change.destination);
  return { message: change.message };
}

export async function createInstanceAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const templateKey = field(data, "templateKey");
    const instance = createInstance({
      templateKey,
      name: field(data, "name"),
      configuration: configuration(data, templateKey),
    });
    return { instanceId: instance.id, destination: widgetPath(instance.id) };
  });
}

export async function updateInstanceAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const instance = getInstance(field(data, "id"));
    if (!instance) throw new WidgetError("This widget instance is unavailable.");
    updateInstance({
      id: instance.id,
      name: data.has("name") ? field(data, "name") : instance.name,
      configuration: configuration(data, instance.templateKey, instance.configuration),
    });
    return { instanceId: instance.id, message: data.has("name") ? "Settings saved." : "Style saved." };
  });
}

export async function updateWidgetSizeAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const instance = getInstance(field(data, "id"));
    if (!instance) throw new WidgetError("This widget instance is unavailable.");
    const embedHeights = Object.fromEntries(widgetEmbedProfiles.map(({ key }) => {
      const value = data.get(widgetEmbedHeightInputName(key));
      if (typeof value !== "string") throw new WidgetError("Enter valid embed heights.");
      return [key, value.trim()];
    }));
    updateInstance({
      id: instance.id,
      name: instance.name,
      configuration: { ...instance.configuration, embedHeights },
    });
    return { instanceId: instance.id, message: "Embed sizes saved." };
  });
}

export async function createLinkAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const previousLinkId = field(data, "previousLinkId") || undefined;
    const link = createLink({ instanceId: field(data, "instanceId"), previousLinkId });
    return { instanceId: link.instanceId, message: previousLinkId ? "Embed link replaced." : "Embed link created." };
  });
}

export async function updateWidgetOriginsAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const instanceId = field(data, "id");
    const value = data.get("origins");
    if (typeof value !== "string") throw new WidgetError("Enter valid approved origins.");
    const origins = value.split(/\r?\n/).map((origin) => origin.trim()).filter(Boolean);
    updateWidgetOrigins(instanceId, origins);
    return { instanceId, message: "Approved origins saved." };
  });
}

export async function toggleLinkAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const status = field(data, "enabled");
    if (status !== "true" && status !== "false") throw new WidgetError("Choose a valid link status.");
    const enabled = status === "true";
    const link = updateLink({ id: field(data, "id"), instanceId: field(data, "instanceId"), enabled });
    return { instanceId: link.instanceId, message: enabled ? "Link enabled." : "Link disabled." };
  });
}

export async function deleteInstanceAction(_state: FormResult, data: FormData) {
  return submit(() => {
    if (field(data, "confirmed") !== "yes") throw new WidgetError("Confirm that you want to delete this widget.");
    const id = field(data, "id");
    deleteInstance(id);
    return { instanceId: id, destination: "/admin?deleted=1" };
  });
}
