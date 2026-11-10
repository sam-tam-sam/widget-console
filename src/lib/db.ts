import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const connections = globalThis as typeof globalThis & {
  widgetConsoleDb?: DatabaseSync;
};

export function getDb() {
  if (connections.widgetConsoleDb) return connections.widgetConsoleDb;

  const path = resolve(/* turbopackIgnore: true */ process.env.WIDGET_DB_PATH || ".data/widget-console.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  } catch (error) {
    db.close();
    throw error;
  }
  connections.widgetConsoleDb = db;
  return db;
}
