"use client";

import { useEffect, useEffectEvent } from "react";
import type { AdminLiveTopic } from "@/lib/admin-live";

const retryDelayMs = 15_000;

export function useAdminLive(topic: AdminLiveTopic, onChange: (widgetId?: string) => void, enabled = true) {
  const notify = useEffectEvent(onChange);

  useEffect(() => {
    if (!enabled) return;
    let stream: EventSource | undefined;
    let retry: number | undefined;

    function disconnect() {
      stream?.close();
      stream = undefined;
      window.clearTimeout(retry);
      retry = undefined;
    }

    function connect() {
      if (document.hidden || !navigator.onLine || stream || retry !== undefined) return;
      const current = new EventSource(`/api/admin/live?topic=${topic}`);
      stream = current;
      current.addEventListener("ready", () => {
        if (stream === current) notify();
      });
      current.addEventListener("change", (event: MessageEvent<string>) => {
        if (stream === current) notify(event.data);
      });
      current.onerror = () => {
        // EventSource retries dropped connections itself. HTTP errors can close it permanently.
        if (stream !== current || current.readyState !== EventSource.CLOSED) return;
        disconnect();
        retry = window.setTimeout(() => {
          retry = undefined;
          connect();
        }, retryDelayMs);
      };
    }

    function handleVisibility() {
      if (document.hidden) disconnect();
      else connect();
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", connect);
    window.addEventListener("offline", disconnect);
    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", disconnect);
    };
  }, [topic, enabled]);
}
