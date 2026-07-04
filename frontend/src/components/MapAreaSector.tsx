import { areaPath, type CustomMapArea } from "../customScenario"

type MapAreaSectorProps = {
  readonly area: CustomMapArea
  readonly minimumCoverage: number
  readonly noGo: boolean
  readonly threat: number
}

type MapAreaLabelProps = {
  readonly area: CustomMapArea
  readonly overlayScale: number
}

export function MapAreaSector(props: MapAreaSectorProps) {
  const path = areaPath(props.area)
  const areaClassName = props.area.id.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
  const coverageTone =
    props.minimumCoverage >= 0.8
      ? "healthy"
      : props.minimumCoverage >= 0.62
        ? "strained"
        : "deficit"
  return (
    <g className={`sector sector-${areaClassName} ${coverageTone}`}>
      <path className="sector-fill" d={path} />
      <path className="sector-outline" d={path} />
      {props.noGo ? <path className="no-go-area" d={path} /> : null}
      {props.threat > 0.42 ? (
        <g className="threat-ring">
          <circle cx={props.area.threat_position.x} cy={props.area.threat_position.y} r="12" />
          <circle cx={props.area.threat_position.x} cy={props.area.threat_position.y} r="18" />
        </g>
      ) : null}
    </g>
  )
}

export function MapAreaLabel({ area, overlayScale }: MapAreaLabelProps) {
  return (
    <g
      className="map-area-label"
      transform={`translate(${area.label_position.x} ${area.label_position.y}) scale(${overlayScale})`}
    >
      <text className="map-label" x="0" y="0">
        {area.label}
      </text>
    </g>
  )
}
