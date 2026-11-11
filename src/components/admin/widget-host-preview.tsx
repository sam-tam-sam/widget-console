"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetHostEmbed } from "@/widgets/contracts";
import { usePreviewImage } from "./use-preview-image";
import { WidgetPreviewWidths } from "./widget-preview-frame";

const profiles = [
  { key: "compact", label: "320px", width: 320, device: "phone", inset: 12 },
  { key: "mobile", label: "390px", width: 390, device: "phone", inset: 12 },
  { key: "tablet", label: "Tablet", width: 768, device: "tablet", inset: 24 },
  { key: "medium", label: "Medium", width: 1024, device: "medium", inset: 24 },
  { key: "wide", label: "Wide", width: undefined, device: "desktop", inset: 24 },
] as const;

const sandbox = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

function ScheduleTime({ value, fallback }: { value: number | null; fallback: string }) {
  if (value === null) return fallback;
  const iso = new Date(value).toISOString();
  return <time dateTime={iso}>{iso.slice(0, 16).replace("T", " ")}</time>;
}

export function WidgetHostPreview({ srcDoc, imageSrc, configuration, channel, now }: {
  srcDoc: string;
  imageSrc?: string;
  configuration: WidgetHostEmbed;
  channel: string;
  now: number;
}) {
  const [selected, select] = useState<(typeof profiles)[number]["key"]>("wide");
  const profile = profiles.find(({ key }) => key === selected) ?? profiles[4];
  const popup = configuration.kind === "popup";
  const announcement = configuration.kind === "announcement" ? configuration : undefined;
  const upcoming = announcement?.startsAt != null && now < announcement.startsAt;
  const ended = announcement?.endsAt != null && now >= announcement.endsAt;
  const [visible, setVisible] = useState(!popup && !upcoming && !ended);
  const readySrcDoc = usePreviewImage(srcDoc, imageSrc, visible);
  const [height, setHeight] = useState(80);
  const frame = useRef<HTMLIFrameElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const wasOpened = useRef(false);

  useEffect(() => {
    if (!popup) return;
    if (visible) {
      wasOpened.current = true;
      dialog.current?.focus({ preventScroll: true });
    } else if (wasOpened.current) {
      trigger.current?.focus({ preventScroll: true });
    }
  }, [popup, visible]);

  useEffect(() => {
    const element = frame.current;
    if (!visible || !element || !readySrcDoc) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "null" || event.source !== element.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.widgetConsole !== 1 || data.channel !== channel) return;
      const keys = Object.keys(data).length;
      if (data.type === "ready" && keys === 3) {
        element.contentWindow?.postMessage({ widgetConsole: 1, channel, type: "opened" }, "*");
      } else if (data.type === "close" && keys === 3) {
        setVisible(false);
      } else if (data.type === "resize" && keys === 4 && !popup &&
        Number.isInteger(data.height) && data.height > 0 && data.height <= 2400) {
        setHeight(data.height);
      }
    };
    window.addEventListener("message", onMessage);
    // Set the content after subscribing, including when the preview is opened by a full page load.
    element.srcdoc = readySrcDoc;
    return () => window.removeEventListener("message", onMessage);
  }, [channel, popup, readySrcDoc, visible]);

  const size = popup ? configuration.sizes[profile.device] : undefined;
  const previewFrame = (
    <iframe
      ref={frame}
      title="Widget preview"
      className="widget-host-preview-frame"
      style={{ height: popup ? "100%" : height }}
      sandbox={sandbox}
    />
  );
  return (
    <div className="widget-preview">
      <WidgetPreviewWidths
        profiles={popup ? profiles : profiles.filter(({ key }) => key !== "tablet" && key !== "medium")}
        selected={selected}
        select={select}
      />
      {announcement && (
        <p>
          Schedule (UTC). Starts <ScheduleTime value={announcement.startsAt} fallback="immediately" />.
          {" "}{announcement.endsAt === null ? "No end time." : <>Ends <ScheduleTime value={announcement.endsAt} fallback="" />.</>}
          {" "}{upcoming ? "Scheduled." : ended ? "Ended." : "Active now."}
        </p>
      )}
      <div
        className="widget-host-preview"
        style={{ width: profile.width ?? "100%" }}
        onKeyDown={(event) => {
          if (popup && visible && event.key === "Escape") {
            event.preventDefault();
            setVisible(false);
          }
        }}
      >
        <div className="widget-host-preview-page" inert={popup && visible}>
          {!popup && visible && previewFrame}
          <div className="widget-host-preview-header">Example header</div>
          <div className="widget-host-preview-main">
            {popup ? (
              <Button ref={trigger} type="button" onClick={() => setVisible(true)}>Open popup</Button>
            ) : !visible && (
              <Button type="button" variant="outline" onClick={() => setVisible(true)}>Show announcement preview</Button>
            )}
          </div>
        </div>
        {visible && size && (
          <div
            ref={dialog}
            role="dialog"
            aria-label="Popup preview"
            tabIndex={-1}
            className="widget-host-preview-overlay"
            style={{ padding: profile.inset }}
            aria-busy={!readySrcDoc}
            onClick={(event) => {
              if (event.target === event.currentTarget) setVisible(false);
            }}
          >
            <div
              className="widget-host-preview-popup"
              data-loading={!readySrcDoc || undefined}
              style={{ width: size.width, height: size.height, transform: `scale(${size.scale / 100})` }}
            >{previewFrame}</div>
          </div>
        )}
      </div>
      <p>{popup
        ? "Open the popup to see its saved content and size. The published popup follows its saved trigger and frequency."
        : "The preview shows the saved announcement above an example header."}</p>
    </div>
  );
}
