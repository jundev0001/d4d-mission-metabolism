# D4D Mission Metabolism Design System

## 1. Atmosphere & Identity

A quiet mission decision surface for one operator supervising many attritable UxVs. The signature is capability budget accounting: graphite surfaces, field-accent command states, thin table rules, and status color shifts that make mission health legible before vehicle telemetry becomes noise.

Visible copy is Korean-first where the D4D glossary gives a clear term: 공통작전상황도(COP), 전자전(EW), 재밍, 거부환경, 인지부하, 회복 탄력성, 사람 개입, UxV, ISR. Product-specific KPI names keep their acronym when that helps judging: MCC, CCR, COP, EW.

## 2. Color

### Palette

| Role | Token | Dark | Usage |
|---|---|---:|---|
| Surface/base | --surface-base | #0b0c0d | Page canvas |
| Surface/panel | --surface-panel | #111315 | Primary panels |
| Surface/elevated | --surface-elevated | #17191b | Cards and toolbars |
| Surface/inset | --surface-inset | #08090a | Map and recessed charts |
| Surface-hover | --surface-hover | #1d2023 | Hover state |
| Text/primary | --text-primary | #f0f2ec | Main text |
| Text/secondary | --text-secondary | #b9bfb8 | Supporting text |
| Text-muted | --text-muted | #7f877f | Metadata |
| Border/subtle | --border-subtle | rgba(255,255,255,0.06) | Soft panel separation |
| Border/strong | --border-strong | rgba(255,255,255,0.14) | Interactive outlines |
| Accent/primary | --accent-primary | #b9c56a | Primary commands |
| Accent-hover | --accent-hover | #d0dc80 | Primary hover |
| Status/success | --status-success | #45c39a | Capability recovery |
| Status/warning | --status-warning | #d3a64f | Degradation |
| Status/danger | --status-danger | #df6f68 | Collapse or high severity |
| Status/info | --status-info | #9ba6aa | Relay and comm state |
| Map/zone-a | --map-zone-a | #78838a | Area A |
| Map/zone-b | --map-zone-b | #c6a052 | Area B |
| Map/zone-c | --map-zone-c | #4f9b7a | Area C |

### Rules

- Accent is for commands, focus, and selected state only.
- Status colors encode state, never decoration.
- Badges and metadata use square or low-radius labels, not pill overload.
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

- Primary: Aptos, SF Pro Text, Helvetica Neue, sans-serif
- Mono: Cascadia Mono, Berkeley Mono, ui-monospace, SFMono-Regular, Menlo, monospace

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

- Main shell: mission rail plus three-column desktop workspace.
- Desktop columns: 296px mission rail, minmax(520px, 1fr) map, 388px decision queue.
- Tablet: two columns, map first, side panels below.
- Mobile: single column with sticky mission strip.

### Rules

- Fixed-format controls have stable dimensions.
- No nested cards. Panels are page regions; cards are repeated recommendation/log items only.
- Map, metrics, and controls keep aspect-ratio or min-height to avoid layout jumps.

## 5. Components

### Metabolism Cell
- **Structure**: compact label, mono value, target/context line, progress rail.
- **Variants**: neutral, success, warning, danger.
- **Spacing**: --space-4 inner, --space-2 between text rows.
- **States**: default, hover, focus when interactive.
- **Accessibility**: value and delta are text, not color-only.
- **Motion**: value changes use 150ms opacity only.

### Command Button
- **Structure**: lucide icon plus label.
- **Variants**: primary, secondary, danger, ghost.
- **Spacing**: --space-2 icon gap, --space-3 horizontal padding.
- **States**: default, hover, active, focus, disabled, loading.
- **Accessibility**: native button, visible focus ring, aria-label for icon-only cases.
- **Motion**: active translates 1px on y-axis.

### Decision Card
- **Structure**: severity rail, title, cause line, action table, KPI deltas, decision controls.
- **Variants**: high, critical, resolved.
- **Spacing**: --space-4 inner, --space-3 between sections.
- **States**: pending, approved, rejected, manual.
- **Accessibility**: decision buttons remain keyboard reachable.
- **Motion**: card status changes use border and opacity transition.

### Mission Rail
- **Structure**: mission clock, objective, constraints, event injection, capability fabric.
- **Variants**: normal, scripted demo running, degraded.
- **Spacing**: --space-4 panel padding, --space-3 control rows.
- **States**: command buttons default, hover, active, focus, disabled.
- **Accessibility**: native controls and visible focus.
- **Motion**: no decorative motion.

### Capability Bar
- **Structure**: capability label, value, rail, deficit marker.
- **Variants**: satisfied, strained, deficit.
- **Spacing**: --space-2 row gap.
- **States**: default, hover with exact value.
- **Accessibility**: `role="meter"` with aria-valuenow.
- **Motion**: transform/width transition on rail fill.

### COP Map
- **Structure**: coordinate grid, sector polygons, sector MCC tags, relay routes, threat rings, no-go hatching, asset glyphs, legend, and compact readout.
- **Variants**: normal, 전자전 압력, no-go, degraded asset.
- **Spacing**: fills map panel, stable aspect ratio, readout below the map frame.
- **States**: threat/no-go overlays are data-driven, not decorative; asset status changes via ring color and opacity.
- **Accessibility**: labelled region and text fallback summary.
- **Motion**: no decorative drift; asset movement uses transform only when simulator state changes and respects reduced motion.

### Black Box Row
- **Structure**: timestamp, kind badge, summary.
- **Variants**: event, recommendation, decision, outcome.
- **Spacing**: --space-3 row padding.
- **States**: hover and selected replay point.
- **Accessibility**: chronological list semantics.
- **Motion**: no decorative animation.

### Scenario Builder
- **Structure**: dedicated custom workspace tab, map name controls, wide flow canvas, draggable event nodes, selected-node editor, graph editor, edge list, import/export/test commands.
- **Variants**: default scenario, imported scenario, invalid import, connection mode, parallel event stage.
- **Spacing**: --space-3 between command clusters, --space-2 inside node controls, compact edge rows in the side stack.
- **States**: selected node uses accent border, connection source uses info outline, valid connection targets use dashed borders, dragging uses elevated surface and cursor state, import/graph errors use danger text.
- **Accessibility**: flow nodes are native buttons with Korean event and target labels; edge removal uses labelled buttons; range controls expose numeric labels.
- **Motion**: only border/background changes on selection, connection mode, and hover.

### Workspace Tabs
- **Structure**: two-button segmented control below mission metrics: 임무 판단 and 커스텀 빌더.
- **Variants**: selected, default.
- **Spacing**: --space-2 button gap, --space-3 horizontal padding.
- **States**: selected uses accent border and elevated surface; focus uses the command button focus ring.
- **Accessibility**: native buttons with `aria-pressed`; switching tabs changes the labelled workspace region.
- **Motion**: border/background changes only.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 120ms | ease-out | Button active state |
| Standard | 180ms | ease-in-out | Panel and card state |
| Data | 240ms | cubic-bezier(0.16, 1, 0.3, 1) | Metric recovery and map updates |

- Only `opacity`, color, border, and rail `width` animate.
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
- Border radius: 8px panels/cards, 6px controls, 4px labels. Avoid pill badges except meter rails and asset dots.
- No decorative orbs, bokeh, or gradient blobs.
