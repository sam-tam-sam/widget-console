"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { widgetAppearanceFields, widgetAppearanceInputName, widgetColorPattern } from "@/widgets/appearance";
import type { WidgetAppearance } from "@/widgets/contracts";

const hexColor = new RegExp(`^${widgetColorPattern}$`);

function ColorField({ name, label, value, fallback, onChange }: {
  name: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [validate, setValidate] = useState(false);
  const valid = hexColor.test(value);
  const showError = validate && !valid;

  function updateColor(value: string) {
    setValidate(false);
    onChange(value);
  }

  return (
    <div className="console-field">
      <Label htmlFor={id}>{label}</Label>
      <div className="console-color-control">
        <Input
          type="color"
          aria-label={`Pick ${label.toLowerCase()}`}
          className="console-color-picker"
          value={(valid ? value : fallback).toLowerCase()}
          onChange={(event) => updateColor(event.currentTarget.value)}
        />
        <Input
          id={id}
          name={name}
          value={value}
          className="console-color-hex"
          onChange={(event) => updateColor(event.currentTarget.value)}
          onBlur={() => setValidate(true)}
          onInvalid={() => setValidate(true)}
          aria-describedby={showError ? `${id}-error` : undefined}
          aria-invalid={showError || undefined}
          autoComplete="off"
          spellCheck={false}
          required
          pattern={widgetColorPattern}
        />
      </div>
      {showError && <small className="console-color-error" id={`${id}-error`}>Enter a color like #a1b2c3.</small>}
    </div>
  );
}

export function WidgetAppearanceFields({ defaults, initial }: {
  defaults: WidgetAppearance;
  initial: WidgetAppearance;
}) {
  const [colors, setColors] = useState(initial);
  const canReset = widgetAppearanceFields.some(({ key }) => colors[key] !== defaults[key]);

  return (
    <fieldset className="console-setting-group console-appearance-fields">
      <legend>Appearance</legend>
      <div className="console-appearance-heading">
        <p>Pick a color or enter a six-digit HEX code. Save settings to apply the colors to this widget.</p>
        <Button type="button" variant="outline" size="sm" disabled={!canReset} onClick={() => setColors(defaults)}>
          Reset colors
        </Button>
      </div>
      <div className="console-setting-grid">
        {widgetAppearanceFields.map(({ key, label }) => (
          <ColorField
            key={key}
            name={widgetAppearanceInputName(key)}
            label={label}
            value={colors[key]}
            fallback={initial[key]}
            onChange={(value) => setColors((current) => ({ ...current, [key]: value }))}
          />
        ))}
      </div>
    </fieldset>
  );
}
