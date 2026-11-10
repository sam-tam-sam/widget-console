# Widget Console development rules

- Read the [template guide](README.md#adding-a-template) before adding or changing a widget. Follow the widget's approved brief for its behavior and design.
- Keep each template's settings, renderer, styles, assets, and client behavior in its own directory under `src/widgets/`. Register it through the shared template registry.
- Reuse the dashboard's Settings, Style, Size, Preview, and Embed links controls. Declare template-specific fields, palette, and iframe height defaults in the template contract. Keep `appearance` and `embedHeights` reserved for the platform.
- Reuse the shared admin form, input, button, and status patterns. Keep dashboard styling and dependencies outside public widget documents.
- Keep widget canvases transparent and verify interactive steps at 320px, 390px, and a wide viewport. Preserve saved instance settings, approved origins, and existing embed URLs across releases.
- Verify the affected behavior with the [project checks](README.md#development-checks). For embed changes, test approved origins, unauthorized framing, direct navigation, and existing links.
