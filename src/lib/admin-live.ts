import "server-only";

export type AdminLiveTopic = "analytics" | "widgets";
type AdminChange = { topic: AdminLiveTopic; widgetId: string };
type Listener = (change: AdminChange) => void;

// Next.js can bundle the admin actions, stream, and embed handler separately.
const runtime = globalThis as typeof globalThis & { widgetConsoleLiveListeners?: Set<Listener> };
const listeners = (runtime.widgetConsoleLiveListeners ??= new Set());

export function subscribeToAdminChanges(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishAdminChange(topic: AdminLiveTopic, widgetId: string) {
  for (const listener of listeners) listener({ topic, widgetId });
}
