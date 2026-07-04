import { areaPath, type CustomMapArea } from "../customScenario"
import { formatPercent, targetLabel } from "../format"
import { useMissionStore } from "../store"
import type { DashboardState, Vehicle } from "../types"

const GRID_LINES = [12, 24, 36, 48, 60, 72, 84] as const

const AIR_VEHICLE_TYPES = new Set([
  "UAV",
  "micro_scout_uav",
  "quad_recon_uav",
  "fixedwing_survey_uav",
  "relay_uav",
  "overwatch_uav",
  "gps_denied_uav",
])

const GROUND_VEHICLE_TYPES = new Set(["UGV", "scout_rover", "sensor_rover"])

export function MapView() {
  const dashboard = useMissionStore((state) => state.dashboard)
  const mapAreas = useMissionStore((state) => state.customScenario.map.areas)
  const mapName = useMissionStore((state) => state.customScenario.map.name)
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
          aria-label={`${mapName} 공통작전상황도`}
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

          {mapAreas.map((area) => (
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
  readonly area: CustomMapArea
  readonly minimumCoverage: number
  readonly noGo: boolean
  readonly threat: number
}

function AreaSector(props: AreaSectorProps) {
  const path = areaPath(props.area)
  const coverageTone =
    props.minimumCoverage >= 0.8
      ? "healthy"
      : props.minimumCoverage >= 0.62
        ? "strained"
        : "deficit"
  return (
    <g className={`sector sector-${props.area.id.toLowerCase()} ${coverageTone}`}>
      <path className="sector-fill" d={path} />
      <path className="sector-outline" d={path} />
      {props.noGo ? <path className="no-go-area" d={path} /> : null}
      {props.threat > 0.42 ? (
        <g className="threat-ring">
          <circle cx={props.area.threat_position.x} cy={props.area.threat_position.y} r="12" />
          <circle cx={props.area.threat_position.x} cy={props.area.threat_position.y} r="18" />
        </g>
      ) : null}
      <text x={props.area.label_position.x} y={props.area.label_position.y} className="map-label">
        {props.area.label}
      </text>
      <text
        x={props.area.metric_position.x}
        y={props.area.metric_position.y}
        className="map-metric"
      >
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
  const className = `asset ${AIR_VEHICLE_TYPES.has(vehicle.type) ? "asset-uav" : ""} ${
    GROUND_VEHICLE_TYPES.has(vehicle.type) ? "asset-ugv" : ""
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
