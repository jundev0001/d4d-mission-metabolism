import { useMissionStore } from "../store"
import type { Vehicle } from "../types"

export function MapView() {
  const dashboard = useMissionStore((state) => state.dashboard)
  if (!dashboard) {
    return null
  }
  const bThreat = dashboard.mission.area_threats["B"] ?? 0

  return (
    <section
      className="panel map-panel"
      aria-label="Common operating picture"
      data-testid="map-view"
    >
      <div className="panel-title">
        <span>2D COP</span>
        <span className="caption">{dashboard.vehicles.length} assets</span>
      </div>
      <svg viewBox="0 0 100 86" className="cop-map" role="img" aria-label="A B C mission areas">
        <rect className="map-bg" x="0" y="0" width="100" height="86" rx="3" />
        <path className="zone zone-a" d="M8 12 L38 7 L44 35 L16 40 Z" />
        <path className="zone zone-b" d="M38 18 L78 16 L86 54 L46 59 Z" />
        <path className="zone zone-c" d="M20 47 L52 55 L86 63 L80 80 L18 76 Z" />
        <text x="18" y="19" className="map-label">
          A
        </text>
        <text x="58" y="30" className="map-label">
          B
        </text>
        <text x="72" y="74" className="map-label">
          C
        </text>
        {bThreat > 0.5 ? <circle className="jammer" cx="61" cy="39" r="18" /> : null}
        {dashboard.mission.no_go_areas.includes("B") ? (
          <path className="no-go" d="M47 24 L80 50 M80 24 L47 50" />
        ) : null}
        {dashboard.vehicles.map((vehicle) => (
          <AssetGlyph key={vehicle.id} vehicle={vehicle} />
        ))}
      </svg>
      <div className="map-legend">
        <span>
          <i className="legend-dot asset-uav" /> UAV
        </span>
        <span>
          <i className="legend-dot asset-ugv" /> UGV
        </span>
        <span>
          <i className="legend-dot asset-synthetic" /> Synthetic
        </span>
        <span>
          <i className="legend-dot jammer-dot" /> EW pressure
        </span>
      </div>
    </section>
  )
}

function AssetGlyph({ vehicle }: { readonly vehicle: Vehicle }) {
  const className = `asset ${vehicle.type === "UAV" ? "asset-uav" : ""} ${
    vehicle.type === "UGV" ? "asset-ugv" : ""
  } ${vehicle.synthetic ? "asset-synthetic" : ""} ${vehicle.status}`
  const radius = vehicle.synthetic ? 1.1 : 1.9
  return (
    <g className={className}>
      <circle cx={vehicle.position.x} cy={vehicle.position.y} r={radius} />
      {!vehicle.synthetic ? (
        <text x={vehicle.position.x + 2.6} y={vehicle.position.y + 1.2} className="asset-label">
          {vehicle.id}
        </text>
      ) : null}
    </g>
  )
}
