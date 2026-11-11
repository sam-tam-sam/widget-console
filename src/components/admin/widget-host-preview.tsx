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

export function WidgetHostPreview({ srcDoc, imageSrc, configuration, channel }: {
  srcDoc: string;
  imageSrc?: string;
  configuration: WidgetHostEmbed;
  channel: string;
}) {
  const [selected, select] = useState<(typeof profiles)[number]["key"]>("wide");
  const profile = profiles.find(({ key }) => key === selected) ?? profiles[4];
  const [visible, setVisible] = useState(false);
  const readySrcDoc = usePreviewImage(srcDoc, imageSrc, visible);
  const frame = useRef<HTMLIFrameElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const wasOpened = useRef(false);

  useEffect(() => {
    if (visible) {
      wasOpened.current = true;
      dialog.current?.focus({ preventScroll: true });
    } else if (wasOpened.current) {
      trigger.current?.focus({ preventScroll: true });
    }
  }, [visible]);

  useEffect(() => {
    const element = frame.current;
    if (!visible || !element || !readySrcDoc) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "null" || event.source !== element.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object" || Object.keys(data).length !== 3 ||
          data.widgetConsole !== 1 || data.channel !== channel) return;
      if (data.type === "ready") {
        element.contentWindow?.postMessage({ widgetConsole: 1, channel, type: "opened" }, "*");
      } else if (data.type === "close") {
        setVisible(false);
      }
    };
    window.addEventListener("message", onMessage);
    // Set the content after subscribing, including when the preview is opened by a full page load.
    element.srcdoc = readySrcDoc;
    return () => window.removeEventListener("message", onMessage);
  }, [channel, readySrcDoc, visible]);

  const size = configuration.sizes[profile.device];
  return (
    <div className="widget-preview">
      <WidgetPreviewWidths
        profiles={profiles}
        selected={selected}
        select={select}
      />
      <div
        className="widget-host-preview"
        style={{ width: profile.width ?? "100%" }}
        onKeyDown={(event) => {
          if (visible && event.key === "Escape") {
            event.preventDefault();
            setVisible(false);
          }
        }}
      >
        <div className="widget-host-preview-page" inert={visible}>
          <div className="widget-host-preview-header">Example header</div>
          <div className="widget-host-preview-main">
            <Button ref={trigger} type="button" onClick={() => setVisible(true)}>Open popup</Button>
          </div>
        </div>
        {visible && (
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
            >
              <iframe ref={frame} title="Widget preview" className="widget-host-preview-frame" sandbox={sandbox} />
            </div>
          </div>
        )}
      </div>
      <p>Open the popup to see its saved image and size. The published popup follows its saved trigger and frequency.</p>
    </div>
  );
}
