"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminMutation, requireAdmin } from "@/lib/auth";
import {
  createInstance,
  createLink,
  deleteInstance,
  getInstance,
  listTemplates,
  updateInstance,
  updateLink,
  WidgetError,
} from "@/lib/widgets";
import type { WidgetConfiguration } from "@/widgets/contracts";
import { widgetAppearanceFields, widgetAppearanceInputName } from "@/widgets/appearance";

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

function origins(data: FormData) {
  return field(data, "origins").split(/\r?\n/).map((origin) => origin.trim()).filter(Boolean);
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

  const value = text ? advancedConfiguration(text) : { ...previous };
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
      name: field(data, "name"),
      configuration: configuration(data, instance.templateKey, instance.configuration),
    });
    return { instanceId: instance.id, message: "Settings saved." };
  });
}

export async function createLinkAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const link = createLink({ instanceId: field(data, "instanceId"), origins: origins(data) });
    return { instanceId: link.instanceId, message: "Embed link created." };
  });
}

export async function updateOriginsAction(_state: FormResult, data: FormData) {
  return submit(() => {
    const link = updateLink({
      id: field(data, "id"),
      instanceId: field(data, "instanceId"),
      origins: origins(data),
    });
    return { instanceId: link.instanceId, message: "Approved origins saved." };
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
