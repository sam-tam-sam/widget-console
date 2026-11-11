"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminLive } from "@/components/admin/use-admin-live";
import type { AnalyticsReport } from "@/lib/analytics-report";
import type { AnalyticsRange } from "@/lib/widget-analytics";

const fallbackRefreshMs = 30_000;
const batchDelayMs = 500;

export function useAnalytics(initial: AnalyticsReport, widgetId?: string) {
  const [report, setReport] = useState(initial);
  const [request, setRequest] = useState({ range: initial.range, revision: 0 });
  const [status, setStatus] = useState<"ready" | "loading" | "error" | "unauthorized" | "unavailable">("ready");
  const scheduleRefresh = useRef<() => void>(undefined);

  function selectRange(range: AnalyticsRange) {
    if (range === request.range) return;
    const url = new URL(window.location.href);
    url.searchParams.set("range", String(range));
    window.history.replaceState(null, "", url);
    setStatus("loading");
    setRequest(({ revision }) => ({ range, revision: revision + 1 }));
  }

  function refresh() {
    setStatus("loading");
    setRequest(({ range, revision }) => ({ range, revision: revision + 1 }));
  }

  useEffect(() => {
    const params = new URLSearchParams({ range: String(request.range) });
    if (widgetId) params.set("widgetId", widgetId);
    const controller = new AbortController();
    let inFlight = false;
    let queued = false;
    let batch: number | undefined;

    function schedule() {
      if (controller.signal.aborted || document.hidden || batch !== undefined) return;
      batch = window.setTimeout(() => {
        batch = undefined;
        void load();
      }, batchDelayMs);
    }

    async function load() {
      if (document.hidden || controller.signal.aborted) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        const response = await fetch(`/api/admin/widget-analytics?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 404) {
          setStatus(response.status === 401 ? "unauthorized" : "unavailable");
          controller.abort();
          return;
        }
        if (!response.ok) throw new Error("Analytics request failed.");
        const data: AnalyticsReport = await response.json();
        if (!controller.signal.aborted) {
          setReport(data);
          setStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      } finally {
        inFlight = false;
        if (queued) {
          queued = false;
          schedule();
        }
      }
    }

    scheduleRefresh.current = schedule;
    if (request.revision > 0) void load();
    const timer = window.setInterval(schedule, fallbackRefreshMs);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      scheduleRefresh.current = undefined;
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(batch);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [request, widgetId]);

  useAdminLive("analytics", (changedWidgetId) => {
    if (!widgetId || !changedWidgetId || changedWidgetId === widgetId) scheduleRefresh.current?.();
  }, status !== "unauthorized" && status !== "unavailable");

  return { report, status, range: request.range, selectRange, refresh };
}
