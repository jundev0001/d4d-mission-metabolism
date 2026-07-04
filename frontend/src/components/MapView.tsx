import { areaLabel, formatPercent, targetLabel } from "../format"
import { useMissionStore } from "../store"
import type { DashboardState, Vehicle } from "../types"

const GRID_LINES = [12, 24, 36, 48, 60, 72, 84] as const

const AREA_SECTORS = [
  {
    id: "A",
    path: "M8 14 L35 9 L45 31 L33 48 L12 42 Z",
    label: { x: 16, y: 21 },
    metric: { x: 16, y: 27 },
    threat: { x: 26, y: 30 },
  },
  {
    id: "B",
    path: "M39 18 L78 16 L88 50 L62 62 L44 48 Z",
    label: { x: 52, y: 30 },
    metric: { x: 52, y: 36 },
    threat: { x: 64, y: 39 },
  },
  {
    id: "C",
    path: "M17 54 L45 50 L87 64 L80 80 L19 77 Z",
    label: { x: 63, y: 70 },
    metric: { x: 63, y: 76 },
    threat: { x: 65, y: 67 },
  },
] as const

export function MapView() {
  const dashboard = useMissionStore((state) => state.dashboard)
  if (!dashboard) {
    return null
  }
  const realAssets = dashboard.vehicles.filter((vehicle) => !vehicle.synthetic).length
  const syntheticAssets = dashboard.vehicles.length - realAssets
  const noGoSummary =
    dashboard.mission.no_go_areas.length === 0
      ? "없음"
      : dashboard.mission.no_go_areas.map(targetLabel).join(", ")
  const relayCount = dashboard.assignments.filter(
    (assignment) => assignment.role === "relay",
  ).length
  const strongestThreat = Math.max(...Object.values(dashboard.mission.area_threats), 0)

  return (
    <section className="panel map-panel" aria-label="공통작전상황도" data-testid="map-view">
      <div className="panel-title">
        <span>
          공통작전상황도 <span className="mono">(COP)</span>
        </span>
        <span className="caption">
          실자산 {realAssets} / 합성 {syntheticAssets}
        </span>
      </div>
      <div className="cop-frame">
        <svg
          viewBox="0 0 100 86"
          className="cop-map"
          role="img"
          aria-label="A B C 구역 공통작전상황도"
        >
          <defs>
            <pattern id="grid-major" width="12" height="12" patternUnits="userSpaceOnUse">
              <path className="grid-pattern" d="M12 0 H0 V12" />
            </pattern>
            <pattern id="no-go-hatch" width="4" height="4" patternUnits="userSpaceOnUse">
              <path className="hatch-line" d="M-1 4 L4 -1 M0 5 L5 0" />
            </pattern>
          </defs>
          <rect className="map-bg" x="0" y="0" width="100" height="86" rx="3" />
          <rect className="map-grid-fill" x="0" y="0" width="100" height="86" />
          {GRID_LINES.map((line) => (
            <g className="grid-axis" key={`grid-${line}`}>
              <line x1={line} y1="0" x2={line} y2="86" />
              <line x1="0" y1={line} x2="100" y2={line} />
            </g>
          ))}
          <path className="route-line route-primary" d="M17 27 L55 38 L78 70" />
          <path className="route-line route-secondary" d="M26 58 L55 38 L73 25" />
          <circle className="relay-node" cx="55" cy="38" r="2.2" />

          {AREA_SECTORS.map((area) => (
            <AreaSector
              key={area.id}
              area={area}
              minimumCoverage={minimumCoverageForArea(dashboard, area.id)}
              noGo={dashboard.mission.no_go_areas.includes(area.id)}
              threat={dashboard.mission.area_threats[area.id] ?? 0}
            />
          ))}

          {dashboard.vehicles.map((vehicle) => (
            <AssetGlyph key={vehicle.id} vehicle={vehicle} />
          ))}
        </svg>
      </div>
      <fieldset className="cop-readout">
        <legend className="sr-only">COP 요약</legend>
        <span>EW 최고 {formatPercent(strongestThreat)}</span>
        <span>No-go {noGoSummary}</span>
        <span>중계축 {relayCount}</span>
      </fieldset>
      <div className="map-legend">
        <span>
          <i className="legend-dot asset-uav" /> UxV 공중
        </span>
        <span>
          <i className="legend-dot asset-ugv" /> UGV 지상
        </span>
        <span>
          <i className="legend-dot asset-synthetic" /> 합성 윙맨
        </span>
        <span>
          <i className="legend-dot jammer-dot" /> 전자전 압력
        </span>
        <span>
          <i className="legend-dot no-go-dot" /> No-go
        </span>
      </div>
    </section>
  )
}

type AreaSectorProps = {
  readonly area: (typeof AREA_SECTORS)[number]
  readonly minimumCoverage: number
  readonly noGo: boolean
  readonly threat: number
}

function AreaSector(props: AreaSectorProps) {
  const coverageTone =
    props.minimumCoverage >= 0.8
      ? "healthy"
      : props.minimumCoverage >= 0.62
        ? "strained"
        : "deficit"
  return (
    <g className={`sector sector-${props.area.id.toLowerCase()} ${coverageTone}`}>
      <path className="sector-fill" d={props.area.path} />
      <path className="sector-outline" d={props.area.path} />
      {props.noGo ? <path className="no-go-area" d={props.area.path} /> : null}
      {props.threat > 0.42 ? (
        <g className="threat-ring">
          <circle cx={props.area.threat.x} cy={props.area.threat.y} r="12" />
          <circle cx={props.area.threat.x} cy={props.area.threat.y} r="18" />
        </g>
      ) : null}
      <text x={props.area.label.x} y={props.area.label.y} className="map-label">
        {areaLabel(props.area.id)}
      </text>
      <text x={props.area.metric.x} y={props.area.metric.y} className="map-metric">
        최저 {formatPercent(props.minimumCoverage)}
      </text>
    </g>
  )
}

function AssetGlyph({ vehicle }: { readonly vehicle: Vehicle }) {
  const availability = Math.min(
    vehicle.health.battery,
    vehicle.health.comm,
    vehicle.health.nav,
    vehicle.health.sensor,
    vehicle.health.health,
  )
  const readiness = availability >= 0.72 ? "ready" : availability >= 0.45 ? "degraded" : "stressed"
  const className = `asset ${vehicle.type === "UAV" ? "asset-uav" : ""} ${
    vehicle.type === "UGV" ? "asset-ugv" : ""
  } ${vehicle.synthetic ? "asset-synthetic" : ""} ${vehicle.status} ${readiness}`
  const radius = vehicle.synthetic ? 1 : 1.75
  return (
    <g className={className}>
      <circle
        className="asset-ring"
        cx={vehicle.position.x}
        cy={vehicle.position.y}
        r={radius + 1.15}
      />
      <circle className="asset-core" cx={vehicle.position.x} cy={vehicle.position.y} r={radius} />
      {!vehicle.synthetic ? (
        <text x={vehicle.position.x + 2.6} y={vehicle.position.y + 1.2} className="asset-label">
          {vehicle.id}
        </text>
      ) : null}
    </g>
  )
}

function minimumCoverageForArea(dashboard: DashboardState, area: string): number {
  const coverage = dashboard.capability_report.area_reports[area]?.coverage
  if (coverage === undefined) {
    return 0
  }
  const values = Object.values(coverage)
  if (values.length === 0) {
    return 0
  }
  return Math.min(...values)
}
