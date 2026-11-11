"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAdminLive } from "@/components/admin/use-admin-live";

const activeControls = 'dialog[open], form[aria-busy="true"]';

export function WidgetLiveRefresh({ widgetId }: { widgetId?: string }) {
  const router = useRouter();
  const deferred = useRef<MutationObserver | null>(null);

  useEffect(() => () => {
    deferred.current?.disconnect();
    deferred.current = null;
  }, [widgetId]);

  useAdminLive("widgets", (changedWidgetId) => {
    if (widgetId && changedWidgetId && changedWidgetId !== widgetId) return;
    if (deferred.current) return;

    const main = document.getElementById("console-main");
    if (!main) return;
    if (!main.querySelector(activeControls)) {
      router.refresh();
      return;
    }

    // Keep an open confirmation or pending form stable until the interaction ends.
    const observer = new MutationObserver(() => {
      if (main.querySelector(activeControls)) return;
      observer.disconnect();
      deferred.current = null;
      if (!document.hidden) router.refresh();
    });
    deferred.current = observer;
    observer.observe(main, {
      subtree: true,
      childList: true,
      attributeFilter: ["open", "aria-busy"],
    });
  });

  return null;
}
