"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import type { FormResult } from "@/app/(admin)/admin/actions";
import { FormMessage } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WidgetImage } from "@/widgets/contracts";

type ImageResult = FormResult & { image?: WidgetImage | null };

export function WidgetImageSettings({ id, image }: { id: string; image?: WidgetImage }) {
  const router = useRouter();
  const inputId = useId();
  const [pending, setPending] = useState<"POST" | "DELETE">();
  const [state, setState] = useState<FormResult>({});
  const [update, setUpdate] = useState<{ previousSrc: string | undefined; image: WidgetImage | null }>();
  const currentImage = update && update.previousSrc === image?.src ? update.image : image;

  async function changeImage(method: "POST" | "DELETE", form?: HTMLFormElement) {
    if (pending) return;
    setPending(method);
    setState({});
    try {
      const response = await fetch(`/api/admin/widget-image/${encodeURIComponent(id)}`, {
        method,
        body: form ? new FormData(form) : undefined,
      });
      const result: ImageResult = await response.json();
      setState(result);
      if (response.ok) {
        if (result.image !== undefined) setUpdate({ previousSrc: image?.src, image: result.image });
        form?.reset();
        router.refresh();
      }
    } catch {
      setState({ error: true, message: "The image change could not be saved. Try again." });
    } finally {
      setPending(undefined);
    }
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void changeImage("POST", event.currentTarget);
  }

  return (
    <section className="console-panel console-form-panel" aria-labelledby="widget-image-heading">
      <div className="console-section-heading">
        <h2 id="widget-image-heading">Popup image</h2>
        <p>The image sets the default popup dimensions. Open Size to adjust the width and height for each screen.</p>
      </div>
      {currentImage && (
        <figure className="console-widget-image">
          {/* Uploaded images use the widget's existing media URL and require no optimization request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentImage.src} alt="" width={currentImage.width} height={currentImage.height} />
          <figcaption>Uploaded image · {currentImage.width} × {currentImage.height}px</figcaption>
        </figure>
      )}
      <form onSubmit={upload} className="console-form" aria-busy={Boolean(pending)}>
        <div className="console-field">
          <Label htmlFor={inputId}>{currentImage ? "Choose a replacement image" : "Choose an image"}</Label>
          <Input
            id={inputId}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={`${inputId}-help`}
            className="console-widget-image-input"
            required
          />
          <small id={`${inputId}-help`}>Static JPEG, PNG, or WebP, up to 5 MiB and 20 megapixels.</small>
        </div>
        <div className="console-image-actions">
          <Button type="submit" disabled={Boolean(pending)}>
            {pending === "POST" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {currentImage ? "Replace image" : "Upload image"}
          </Button>
          {currentImage && (
            <Button type="button" variant="outline" disabled={Boolean(pending)} onClick={() => void changeImage("DELETE")}>
              {pending === "DELETE" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Remove image
            </Button>
          )}
        </div>
        <FormMessage state={state} />
      </form>
    </section>
  );
}
