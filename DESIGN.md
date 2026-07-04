# D4D Mission Metabolism Design System

## 1. Atmosphere & Identity

A quiet mission command surface for one operator supervising many attritable UxVs. The signature is capability metabolism: dark layered panels, thin tactical lines, and KPI color shifts that make mission health legible before vehicle telemetry becomes noise.

## 2. Color

### Palette

| Role | Token | Dark | Usage |
|---|---|---:|---|
| Surface/base | --surface-base | #08090a | Page canvas |
| Surface/panel | --surface-panel | #101114 | Primary panels |
| Surface/elevated | --surface-elevated | #17191d | Cards and toolbars |
| Surface/inset | --surface-inset | #0c0d10 | Map and recessed charts |
| Surface-hover | --surface-hover | #202329 | Hover state |
| Text/primary | --text-primary | #f4f7fb | Main text |
| Text/secondary | --text-secondary | #c2cad6 | Supporting text |
| Text-muted | --text-muted | #7d8796 | Metadata |
| Border/subtle | --border-subtle | rgba(255,255,255,0.06) | Soft panel separation |
| Border/strong | --border-strong | rgba(255,255,255,0.13) | Interactive outlines |
| Accent/primary | --accent-primary | #7170ff | Primary commands |
| Accent-hover | --accent-hover | #8d8cff | Primary hover |
| Status/success | --status-success | #31d0aa | Capability recovery |
| Status/warning | --status-warning | #f2b84b | Degradation |
| Status/danger | --status-danger | #ff6b6b | Collapse or high severity |
| Status/info | --status-info | #66c6ff | Relay and comm state |
| Map/zone-a | --map-zone-a | #5ba7ff | Area A |
| Map/zone-b | --map-zone-b | #f2b84b | Area B |
| Map/zone-c | --map-zone-c | #31d0aa | Area C |

### Rules

- Accent is for commands, focus, and selected state only.
- Status colors encode state, never decoration.
- No raw colors outside `DESIGN.md` and CSS token declarations.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| H1 | 28px | 590 | 1.15 | 0 | Main product title |
| H2 | 20px | 590 | 1.25 | 0 | Panel titles |
| H3 | 16px | 590 | 1.35 | 0 | Card titles |
| Body | 14px | 400 | 1.5 | 0 | Default text |
| Body/sm | 13px | 400 | 1.45 | 0 | Dense UI copy |
| Caption | 12px | 510 | 1.35 | 0.02em | Labels and metadata |
| Mono | 12px | 500 | 1.4 | 0 | Metrics and IDs |

### Font Stack

- Primary: Inter Variable, SF Pro Display, system-ui, sans-serif
- Mono: Berkeley Mono, ui-monospace, SFMono-Regular, Menlo, monospace

### Rules

- No viewport-scaled font sizes.
- Button and badge labels stay on one line.
- Dense dashboard text uses smaller scale, not hero typography.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base.

| Token | Value | Usage |
|---|---:|---|
| --space-1 | 4px | Icon gap |
| --space-2 | 8px | Tight clusters |
| --space-3 | 12px | Compact padding |
| --space-4 | 16px | Panel padding |
| --space-5 | 20px | Dashboard gaps |
| --space-6 | 24px | Major panel padding |
| --space-8 | 32px | Section spacing |

### Grid

- Main shell: top status strip plus three-column desktop workspace.
- Desktop columns: 280px left, minmax(420px, 1fr) map, 360px right.
- Tablet: two columns, map first, side panels below.
- Mobile: single column with sticky mission strip.

### Rules

- Fixed-format controls have stable dimensions.
- No nested cards. Panels are page regions; cards are repeated recommendation/log items only.
- Map, metrics, and controls keep aspect-ratio or min-height to avoid layout jumps.

## 5. Components

### Metric Tile
- **Structure**: label, mono value, delta text, progress rail.
- **Variants**: neutral, success, warning, danger.
- **Spacing**: --space-3 inner, --space-2 between text rows.
- **States**: default, hover, focus when interactive.
- **Accessibility**: value and delta are text, not color-only.
- **Motion**: value changes use 150ms opacity/transform.

### Command Button
- **Structure**: lucide icon plus label.
- **Variants**: primary, secondary, danger, ghost.
- **Spacing**: --space-2 icon gap, --space-3 horizontal padding.
- **States**: default, hover, active, focus, disabled, loading.
- **Accessibility**: native button, visible focus ring, aria-label for icon-only cases.
- **Motion**: active translates 1px on y-axis.

### Recommendation Card
- **Structure**: severity rail, title, cause chips, action list, KPI deltas, decision controls.
- **Variants**: high, critical, resolved.
- **Spacing**: --space-4 inner, --space-3 between sections.
- **States**: pending, approved, rejected, manual.
- **Accessibility**: decision buttons remain keyboard reachable.
- **Motion**: card status changes use border and opacity transition.

### Capability Bar
- **Structure**: capability label, value, rail, deficit marker.
- **Variants**: satisfied, strained, deficit.
- **Spacing**: --space-2 row gap.
- **States**: default, hover with exact value.
- **Accessibility**: `role="meter"` with aria-valuenow.
- **Motion**: transform/width transition on rail fill.

### COP Map
- **Structure**: SVG areas, risk zones, asset glyphs, route lines, legend.
- **Variants**: normal, jammed, no-go.
- **Spacing**: fills map panel, stable aspect ratio.
- **States**: hover asset, selected event.
- **Accessibility**: labelled region and text fallback summary.
- **Motion**: asset drift uses transform only and respects reduced motion.

### Black Box Row
- **Structure**: timestamp, kind badge, summary.
- **Variants**: event, recommendation, decision, outcome.
- **Spacing**: --space-3 row padding.
- **States**: hover and selected replay point.
- **Accessibility**: chronological list semantics.
- **Motion**: no decorative animation.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 120ms | ease-out | Button active state |
| Standard | 180ms | ease-in-out | Panel and card state |
| Data | 240ms | cubic-bezier(0.16, 1, 0.3, 1) | Metric recovery and map updates |

- Only `transform`, `opacity`, and rail `width` animate.
- Respect `prefers-reduced-motion`.
- Motion must indicate state change or affordance.

## 7. Depth & Surface

### Strategy

Mixed tonal shift and subtle borders.

| Level | Value | Usage |
|---|---|---|
| Base | --surface-base | Page background |
| Inset | --surface-inset + border subtle | Map and charts |
| Panel | --surface-panel + border subtle | Workspace regions |
| Elevated | --surface-elevated + border strong | Recommendation cards and controls |

- Shadows are minimal and used only for popover-like elevation.
- Border radius: 8px panels/cards, 6px controls, 999px pills.
- No decorative orbs, bokeh, or gradient blobs.
