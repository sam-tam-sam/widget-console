"use client";

import { useEffect, useState } from "react";
import type { AnalyticsReport } from "@/lib/analytics-report";
import type { AnalyticsRange } from "@/lib/widget-analytics";

export const analyticsRefreshSeconds = 30;

export function useAnalytics(initial: AnalyticsReport, widgetId?: string) {
  const [report, setReport] = useState(initial);
  const [request, setRequest] = useState({ range: initial.range, revision: 0 });
  const [status, setStatus] = useState<"ready" | "loading" | "error" | "unauthorized" | "unavailable">("ready");

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

    async function load() {
      if (document.hidden || inFlight || controller.signal.aborted) return;
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
      }
    }

    if (request.revision > 0) void load();
    const timer = window.setInterval(load, analyticsRefreshSeconds * 1000);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [request, widgetId]);

  return { report, status, range: request.range, selectRange, refresh };
}
