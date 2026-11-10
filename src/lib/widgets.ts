import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db";
import { normalizeOrigins } from "@/lib/embeds";
import {
  WidgetError,
  type WidgetConfiguration,
  type WidgetInstance,
  type WidgetTemplate,
  type WidgetTemplateSummary,
} from "@/widgets/contracts";
import { registeredTemplates } from "@/widgets/registry";
import { renderWidgetDocument } from "@/widgets/html";
import { parseWidgetAppearance } from "@/widgets/appearance";

export { WidgetError };

type InstanceRow = {
  id: string;
  template_key: string;
  name: string;
  config_json: string;
};

type LinkRow = {
  id: string;
  instance_id: string;
  origins_json: string;
  enabled: number;
};

type EmbedRow = InstanceRow & Pick<LinkRow, "origins_json">;

export type WidgetLink = {
  id: string;
  instanceId: string;
  origins: string[];
  enabled: boolean;
};

const prepared = new WeakSet<DatabaseSync>();
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

function storage(): DatabaseSync {
  const db = getDb();
  if (!prepared.has(db)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS widget_instances (
        id TEXT PRIMARY KEY,
        template_key TEXT NOT NULL,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS widget_embed_links (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL REFERENCES widget_instances(id),
        origins_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS widget_embed_links_instance_id
        ON widget_embed_links(instance_id);
    `);
    prepared.add(db);
  }
  return db;
}

function instanceFromRow(row: InstanceRow): WidgetInstance {
  return {
    id: row.id,
    templateKey: row.template_key,
    name: row.name,
    configuration: JSON.parse(row.config_json) as WidgetConfiguration,
  };
}

function linkFromRow(row: LinkRow): WidgetLink {
  return {
    id: row.id,
    instanceId: row.instance_id,
    origins: JSON.parse(row.origins_json) as string[],
    enabled: row.enabled === 1,
  };
}

function requireTemplate(key: string): WidgetTemplate {
  const template = registeredTemplates().find((candidate) => candidate.key === key);
  if (!template) throw new WidgetError("This template is unavailable.");
  return template;
}

function cleanName(input: string): string {
  const name = input.trim();
  if (!name || name.length > 100) {
    throw new WidgetError("Use a name between 1 and 100 characters.");
  }
  return name;
}

function findInstance(db: DatabaseSync, id: string): InstanceRow | undefined {
  return db.prepare(
    "SELECT id, template_key, name, config_json FROM widget_instances WHERE id = ?",
  ).get(id) as InstanceRow | undefined;
}

function readInstance(db: DatabaseSync, id: string): InstanceRow {
  const row = findInstance(db, id);
  if (!row) throw new WidgetError("This widget instance is unavailable.");
  return row;
}

export function listTemplates(): WidgetTemplateSummary[] {
  return registeredTemplates().map(({ key, name, description, configurationFields, appearance, embedHeight }) =>
    ({ key, name, description, configurationFields, appearance, embedHeight }),
  );
}

function parseInstanceConfiguration(template: WidgetTemplate, input: unknown): WidgetConfiguration {
  if (!template.appearance || !input || typeof input !== "object" || Array.isArray(input)) {
    return template.parseConfiguration(input);
  }
  const { appearance, ...settings } = input as WidgetConfiguration;
  const configuration = template.parseConfiguration(settings);
  const overrides = parseWidgetAppearance(appearance, template.appearance);
  return Object.keys(overrides).length ? { ...configuration, appearance: overrides } : configuration;
}

export function listInstances(): WidgetInstance[] {
  const rows = storage().prepare(`
    SELECT id, template_key, name, config_json
    FROM widget_instances ORDER BY created_at DESC, id DESC
  `).all() as InstanceRow[];
  return rows.map(instanceFromRow);
}

export function getInstance(id: string): WidgetInstance | null {
  if (!uuidPattern.test(id)) return null;
  const row = findInstance(storage(), id);
  return row ? instanceFromRow(row) : null;
}

export function listLinks(instanceId?: string): WidgetLink[] {
  const db = storage();
  const rows = (instanceId === undefined ? db.prepare(`
    SELECT id, instance_id, origins_json, enabled
    FROM widget_embed_links ORDER BY created_at DESC, id DESC
  `).all() : db.prepare(`
    SELECT id, instance_id, origins_json, enabled
    FROM widget_embed_links WHERE instance_id = ? ORDER BY created_at DESC, id DESC
  `).all(instanceId)) as LinkRow[];
  return rows.map(linkFromRow);
}

export function createInstance(input: {
  templateKey: string;
  name: string;
  configuration?: unknown;
}): WidgetInstance {
  const template = requireTemplate(input.templateKey);
  const name = cleanName(input.name);
  const configuration = parseInstanceConfiguration(template, input.configuration);
  const id = randomUUID();

  storage().prepare(`
    INSERT INTO widget_instances (id, template_key, name, config_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, template.key, name, JSON.stringify(configuration), Date.now());

  return { id, templateKey: template.key, name, configuration };
}

export function updateInstance(input: {
  id: string;
  name: string;
  configuration?: unknown;
}): WidgetInstance {
  const name = cleanName(input.name);
  const db = storage();
  const current = readInstance(db, input.id);
  const configuration = input.configuration === undefined
    ? null
    : JSON.stringify(parseInstanceConfiguration(requireTemplate(current.template_key), input.configuration));
  const updated = db.prepare(`
    UPDATE widget_instances SET name = ?, config_json = COALESCE(?, config_json)
    WHERE id = ? RETURNING id, template_key, name, config_json
  `).get(name, configuration, input.id) as InstanceRow | undefined;
  if (!updated) throw new WidgetError("This widget instance is unavailable.");
  return instanceFromRow(updated);
}

export function deleteInstance(id: string): void {
  const db = storage();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM widget_embed_links WHERE instance_id = ?").run(id);
    const result = db.prepare("DELETE FROM widget_instances WHERE id = ?").run(id);
    if (result.changes !== 1) throw new WidgetError("This widget instance is unavailable.");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createLink(input: { instanceId: string; origins: readonly string[] }): WidgetLink {
  const origins = normalizeOrigins(input.origins);
  const db = storage();
  const instance = readInstance(db, input.instanceId);
  requireTemplate(instance.template_key);
  const id = randomUUID();

  db.prepare(`
    INSERT INTO widget_embed_links (id, instance_id, origins_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, instance.id, JSON.stringify(origins), Date.now());

  return { id, instanceId: instance.id, origins, enabled: true };
}

export function updateLink(input: {
  id: string;
  instanceId?: string;
  origins?: readonly string[];
  enabled?: boolean;
}): WidgetLink {
  if (input.origins === undefined && input.enabled === undefined) {
    throw new WidgetError("Choose what to update.");
  }

  const origins = input.origins === undefined ? null : JSON.stringify(normalizeOrigins(input.origins));
  const enabled = input.enabled === undefined ? null : Number(input.enabled);
  const instanceId = input.instanceId ?? null;
  const updated = storage().prepare(`
    UPDATE widget_embed_links
    SET origins_json = COALESCE(?, origins_json), enabled = COALESCE(?, enabled)
    WHERE id = ? AND (? IS NULL OR instance_id = ?)
    RETURNING id, instance_id, origins_json, enabled
  `).get(origins, enabled, input.id, instanceId, instanceId) as LinkRow | undefined;

  if (!updated) throw new WidgetError("This embed link is unavailable.");
  return linkFromRow(updated);
}

function renderSavedInstance(row: InstanceRow) {
  const template = registeredTemplates().find((candidate) => candidate.key === row.template_key);
  if (!template) return null;

  try {
    const instance = instanceFromRow(row);
    const configuration = parseInstanceConfiguration(template, instance.configuration);
    return {
      name: instance.name,
      embedHeight: template.embedHeight,
      ...renderWidgetDocument(template, { ...instance, configuration }),
    };
  } catch (error) {
    if (error instanceof WidgetError || error instanceof SyntaxError) return null;
    throw error;
  }
}

/** Renders saved public widget content for the authenticated admin preview. */
export function renderInstancePreview(id: string) {
  if (!uuidPattern.test(id)) return null;
  const row = findInstance(storage(), id);
  return row ? renderSavedInstance(row) : null;
}

export function resolveEmbed(id: string) {
  if (!uuidPattern.test(id)) return null;

  const row = storage().prepare(`
    SELECT i.id, i.template_key, i.name, i.config_json, l.origins_json
    FROM widget_embed_links l
    JOIN widget_instances i ON l.instance_id = i.id
    WHERE l.id = ? AND l.enabled = 1
  `).get(id) as EmbedRow | undefined;

  if (!row) return null;

  try {
    const origins = normalizeOrigins(JSON.parse(row.origins_json));
    const preview = renderSavedInstance(row);
    return preview ? { origins, html: preview.html, scriptHashes: preview.scriptHashes } : null;
  } catch (error) {
    if (error instanceof WidgetError || error instanceof SyntaxError) return null;
    throw error;
  }
}
