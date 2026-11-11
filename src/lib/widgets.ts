import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db";
import { applicationOrigin, normalizeOrigins } from "@/lib/embeds";
import {
  WidgetError,
  type WidgetConfiguration,
  type WidgetInstance,
  type WidgetTemplate,
  type WidgetTemplateSummary,
} from "@/widgets/contracts";
import { registeredTemplates } from "@/widgets/registry";
import { renderWidgetDocument } from "@/widgets/html";
import type { WidgetHostFrame } from "@/widgets/host-frame";
import { parseWidgetAppearance } from "@/widgets/appearance";
import { defaultWidgetEmbedHeights, parseWidgetEmbedHeights, resolveWidgetEmbedHeights } from "@/widgets/embed-size";

export { WidgetError };

type InstanceRow = {
  id: string;
  template_key: string;
  name: string;
  config_json: string;
  approved_origins_json: string | null;
};

type LinkRow = {
  id: string;
  instance_id: string;
  enabled: number;
};

type EmbedRow = InstanceRow & { origins_json: string };

export type WidgetLink = {
  id: string;
  instanceId: string;
  enabled: boolean;
};

const prepared = new WeakSet<DatabaseSync>();
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

function storage(): DatabaseSync {
  const db = getDb();
  if (!prepared.has(db)) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS widget_instances (
          id TEXT PRIMARY KEY,
          template_key TEXT NOT NULL,
          name TEXT NOT NULL,
          config_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          approved_origins_json TEXT
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
        CREATE TABLE IF NOT EXISTS widget_images (
          instance_id TEXT PRIMARY KEY REFERENCES widget_instances(id) ON DELETE CASCADE,
          id TEXT NOT NULL UNIQUE,
          content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
          width INTEGER NOT NULL CHECK (width > 0),
          height INTEGER NOT NULL CHECK (height > 0),
          bytes BLOB NOT NULL
        ) STRICT;
      `);
      const column = db.prepare("SELECT 1 FROM pragma_table_info('widget_instances') WHERE name = ?")
        .get("approved_origins_json");
      if (!column) db.exec("ALTER TABLE widget_instances ADD COLUMN approved_origins_json TEXT");
      // Remove saved instances of the retired template and revoke their embed links.
      db.exec(`
        DELETE FROM widget_embed_links WHERE instance_id IN (
          SELECT id FROM widget_instances WHERE template_key = 'announcement'
        );
        DELETE FROM widget_instances WHERE template_key = 'announcement';
      `);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    prepared.add(db);
  }
  return db;
}

function instanceFromRow(row: InstanceRow): WidgetInstance {
  const template = registeredTemplates().find(({ key }) => key === row.template_key);
  const image = template?.imageUpload ? readImageMetadata(row.id) : undefined;
  return {
    id: row.id,
    templateKey: row.template_key,
    name: row.name,
    configuration: JSON.parse(row.config_json) as WidgetConfiguration,
    approvedOrigins: row.approved_origins_json === null ? null : JSON.parse(row.approved_origins_json) as string[],
    ...(image && { image }),
  };
}

function readImageMetadata(instanceId: string) {
  const origin = applicationOrigin();
  if (!origin) return undefined;
  const image = storage().prepare("SELECT id, width, height FROM widget_images WHERE instance_id = ?")
    .get(instanceId) as { id: string; width: number; height: number } | undefined;
  if (!image) return undefined;
  return { src: new URL(`/widget-media/${image.id}`, origin).href, width: image.width, height: image.height };
}

export function readWidgetImage(id: string) {
  if (!uuidPattern.test(id)) return null;
  return storage().prepare("SELECT content_type, bytes FROM widget_images WHERE id = ?").get(id) as
    { content_type: string; bytes: Uint8Array } | undefined;
}

export function saveWidgetImage(instanceId: string, image: { contentType: string; width: number; height: number; bytes: Uint8Array }) {
  const result = storage().prepare(`
    INSERT INTO widget_images (instance_id, id, content_type, width, height, bytes)
    SELECT id, ?, ?, ?, ?, ? FROM widget_instances WHERE id = ?
    ON CONFLICT (instance_id) DO UPDATE SET id = excluded.id, content_type = excluded.content_type,
      width = excluded.width, height = excluded.height, bytes = excluded.bytes
  `).run(randomUUID(), image.contentType, image.width, image.height, image.bytes, instanceId);
  if (result.changes !== 1) throw new WidgetError("This widget instance is unavailable.");
}

export function removeWidgetImage(instanceId: string) {
  storage().prepare("DELETE FROM widget_images WHERE instance_id = ?").run(instanceId);
}

function linkFromRow(row: LinkRow): WidgetLink {
  return {
    id: row.id,
    instanceId: row.instance_id,
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
    "SELECT id, template_key, name, config_json, approved_origins_json FROM widget_instances WHERE id = ?",
  ).get(id) as InstanceRow | undefined;
}

function readInstance(db: DatabaseSync, id: string): InstanceRow {
  const row = findInstance(db, id);
  if (!row) throw new WidgetError("This widget instance is unavailable.");
  return row;
}

export function listTemplates(): WidgetTemplateSummary[] {
  return registeredTemplates().map(({ key, name, description, configurationFields, appearance, embedHeight, embedHeights, hostEmbed, imageUpload }) =>
    ({ key, name, description, configurationFields, appearance, embedHeight, embedHeights, hostEmbed, imageUpload }),
  );
}

function parseInstanceConfiguration(template: WidgetTemplate, input: unknown): WidgetConfiguration {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return template.parseConfiguration(input);
  }
  const { appearance, embedHeights, ...settings } = input as WidgetConfiguration;
  const configuration = template.parseConfiguration(settings);
  const colors = template.appearance && parseWidgetAppearance(appearance, template.appearance);
  const heights = parseWidgetEmbedHeights(embedHeights, defaultWidgetEmbedHeights(template));
  if (colors && Object.keys(colors).length) configuration.appearance = colors;
  if (Object.keys(heights).length) configuration.embedHeights = heights;
  return configuration;
}

export function listInstances(): WidgetInstance[] {
  const rows = storage().prepare(`
    SELECT id, template_key, name, config_json, approved_origins_json
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
    SELECT id, instance_id, enabled
    FROM widget_embed_links ORDER BY created_at DESC, id DESC
  `).all() : db.prepare(`
    SELECT id, instance_id, enabled
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
    INSERT INTO widget_instances (id, template_key, name, config_json, created_at, approved_origins_json)
    VALUES (?, ?, ?, ?, ?, '[]')
  `).run(id, template.key, name, JSON.stringify(configuration), Date.now());

  return { id, templateKey: template.key, name, configuration, approvedOrigins: [] };
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
    WHERE id = ? RETURNING id, template_key, name, config_json, approved_origins_json
  `).get(name, configuration, input.id) as InstanceRow | undefined;
  if (!updated) throw new WidgetError("This widget instance is unavailable.");
  return instanceFromRow(updated);
}

export function updateWidgetOrigins(id: string, origins: readonly string[]): void {
  const approved = JSON.stringify(normalizeOrigins(origins));
  const db = storage();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare("UPDATE widget_instances SET approved_origins_json = ? WHERE id = ?").run(approved, id);
    if (result.changes !== 1) throw new WidgetError("This widget instance is unavailable.");
    // Keep the legacy column in sync so a rollback still honors this policy.
    db.prepare("UPDATE widget_embed_links SET origins_json = ? WHERE instance_id = ?").run(approved, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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

export function createLink(input: { instanceId: string; previousLinkId?: string }): WidgetLink {
  const db = storage();
  const id = randomUUID();

  db.exec("BEGIN IMMEDIATE");
  try {
    const instance = readInstance(db, input.instanceId);
    requireTemplate(instance.template_key);
    const previous = db.prepare(`
      SELECT id, origins_json FROM widget_embed_links
      WHERE instance_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
    `).get(instance.id) as { id: string; origins_json: string } | undefined;
    if (previous?.id !== input.previousLinkId) {
      throw new WidgetError("The embed link changed. Reload this page and try again.");
    }

    if (previous) db.prepare("DELETE FROM widget_embed_links WHERE instance_id = ?").run(instance.id);
    db.prepare(`
      INSERT INTO widget_embed_links (id, instance_id, origins_json, created_at) VALUES (?, ?, ?, ?)
    `).run(id, instance.id, instance.approved_origins_json ?? previous?.origins_json ?? "[]", Date.now());
    db.exec("COMMIT");
    return { id, instanceId: instance.id, enabled: true };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateLink(input: {
  id: string;
  instanceId?: string;
  enabled: boolean;
}): WidgetLink {
  const instanceId = input.instanceId ?? null;
  const updated = storage().prepare(`
    UPDATE widget_embed_links SET enabled = ?
    WHERE id = ? AND (? IS NULL OR instance_id = ?)
    RETURNING id, instance_id, enabled
  `).get(Number(input.enabled), input.id, instanceId, instanceId) as LinkRow | undefined;

  if (!updated) throw new WidgetError("This embed link is unavailable.");
  return linkFromRow(updated);
}

function resolveSavedInstance(row: InstanceRow) {
  const template = registeredTemplates().find((candidate) => candidate.key === row.template_key);
  if (!template) return null;

  try {
    const saved = instanceFromRow(row);
    const instance = { ...saved, configuration: parseInstanceConfiguration(template, saved.configuration) };
    return { template, instance, hostEmbed: template.resolveHostEmbed?.(instance) };
  } catch (error) {
    if (error instanceof WidgetError || error instanceof SyntaxError) return null;
    throw error;
  }
}

/** Renders saved public widget content for the authenticated admin preview. */
export function renderInstancePreview(id: string, frame?: WidgetHostFrame) {
  if (!uuidPattern.test(id)) return null;
  const row = findInstance(storage(), id);
  const saved = row && resolveSavedInstance(row);
  if (!saved) return null;
  const { template, instance, hostEmbed } = saved;
  return {
    name: instance.name,
    imageSrc: instance.image?.src,
    embedHeights: resolveWidgetEmbedHeights(template, instance.configuration.embedHeights),
    hostEmbed,
    ...renderWidgetDocument(template, instance, frame),
  };
}

function findEnabledEmbed(id: string) {
  if (!uuidPattern.test(id)) return null;

  return storage().prepare(`
    SELECT i.id, i.template_key, i.name, i.config_json, i.approved_origins_json, l.origins_json
    FROM widget_embed_links l
    JOIN widget_instances i ON l.instance_id = i.id
    WHERE l.id = ? AND l.enabled = 1
  `).get(id) as EmbedRow | undefined;
}

function embedOrigins(row: EmbedRow): string[] | null {
  try {
    return normalizeOrigins(JSON.parse(row.approved_origins_json ?? row.origins_json));
  } catch (error) {
    if (error instanceof WidgetError || error instanceof SyntaxError) return null;
    throw error;
  }
}

export function resolveEmbedPolicy(id: string) {
  const row = findEnabledEmbed(id);
  if (!row) return null;
  const origins = embedOrigins(row);
  return origins ? { widgetId: row.id, origins } : null;
}

export function resolveHostEmbed(id: string, origin: string) {
  const row = findEnabledEmbed(id);
  if (!row || !embedOrigins(row)?.includes(origin)) return null;
  const saved = resolveSavedInstance(row);
  return saved?.instance.image ? saved.hostEmbed ?? null : null;
}

export function resolveEmbed(id: string, frame?: WidgetHostFrame) {
  const row = findEnabledEmbed(id);
  if (!row) return null;
  const origins = embedOrigins(row);
  if (!origins) return null;
  const saved = resolveSavedInstance(row);
  if (!saved) return null;
  const { template, instance, hostEmbed } = saved;
  if (hostEmbed && (!instance.image || !frame || !origins.includes(frame.parentOrigin))) return null;
  return { origins, waitForOpen: Boolean(hostEmbed), ...renderWidgetDocument(template, instance, frame) };
}
