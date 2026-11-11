"use client";

import { useEffect, useState } from "react";

function readDataUrl(image: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(image);
  });
}

export function usePreviewImage(srcDoc: string, imageSrc: string | undefined, visible: boolean) {
  const [loaded, setLoaded] = useState<{ src: string; dataUrl: string | null }>();
  const ready = loaded !== undefined && loaded.src === imageSrc;

  useEffect(() => {
    if (!visible || !imageSrc || ready) return;
    const controller = new AbortController();
    const { signal } = controller;

    async function loadImage(src: string) {
      let dataUrl: string | null = null;
      try {
        // Fetch in the authenticated top-level document. The preview can then
        // display the raster without a cross-origin request from its sandbox.
        const url = new URL(src);
        if (url.origin === window.location.origin && url.pathname.startsWith("/widget-media/")) {
          const response = await fetch(url, { signal });
          const mime = response.headers.get("Content-Type");
          if (response.ok && (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp")) {
            dataUrl = await readDataUrl(await response.blob());
          }
        }
      } catch {
        // The original asset URL remains available if this request fails.
      }
      if (!signal.aborted) setLoaded({ src, dataUrl });
    }

    void loadImage(imageSrc);
    return () => controller.abort();
  }, [imageSrc, ready, visible]);

  if (!imageSrc) return srcDoc;
  if (!ready) return undefined;
  return loaded.dataUrl ? srcDoc.replace(`src="${imageSrc}"`, `src="${loaded.dataUrl}"`) : srcDoc;
}
