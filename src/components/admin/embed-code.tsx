"use client";

import { useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmbedCode({ markup, kind = "iframe" }: { markup: string; kind?: "iframe" | "script" }) {
  const [status, setStatus] = useState<"copied" | "selected">();
  const field = useRef<HTMLTextAreaElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const id = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(markup);
      setStatus("copied");
    } catch {
      if (disclosure.current) disclosure.current.open = true;
      field.current?.focus();
      field.current?.select();
      setStatus("selected");
    }
  }

  return (
    <div className="console-embed-code">
      <div className="console-copy-row">
        <Button type="button" variant="secondary" onClick={copy}>
          {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {kind === "script" ? "Copy head script" : "Copy embed code"}
        </Button>
        {status && <span className="console-copy-status" role="status">{status === "copied" ? "Copied" : "Code selected. Use your copy shortcut."}</span>}
      </div>
      <details className="console-disclosure" ref={disclosure}>
        <summary>{kind === "script" ? "View head script" : "View iframe code"}</summary>
        <div className="console-field">
          <label className="console-field-label" htmlFor={id}>{kind === "script" ? "Head script" : "Embed code"}</label>
          <textarea ref={field} id={id} className="console-code-field" rows={3} value={markup} readOnly spellCheck={false} />
        </div>
      </details>
    </div>
  );
}
