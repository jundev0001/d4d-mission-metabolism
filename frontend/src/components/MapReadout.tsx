import type { CustomMapArea } from "../customScenario"
import { formatPercent, targetLabel } from "../format"
import { countRelayAssignments, minimumCoverageForArea } from "../mapCoverage"
import type { DashboardState } from "../types"

type MapReadoutProps = {
  readonly dashboard: DashboardState
  readonly mapAreas: readonly CustomMapArea[]
}

export function MapReadout({ dashboard, mapAreas }: MapReadoutProps) {
  const noGoSummary =
    dashboard.mission.no_go_areas.length === 0
      ? "없음"
      : dashboard.mission.no_go_areas.map(targetLabel).join(", ")
  const relayCount = countRelayAssignments(dashboard)
  const strongestThreat = Math.max(...Object.values(dashboard.mission.area_threats), 0)

  return (
    <fieldset className="cop-readout">
      <legend className="sr-only">COP 요약</legend>
      {mapAreas.map((area) => (
        <span className="area-coverage-chip" key={area.id}>
          {area.label} 최저 {formatPercent(minimumCoverageForArea(dashboard, area.id))}
        </span>
      ))}
      <span>EW 최고 {formatPercent(strongestThreat)}</span>
      <span>No-go {noGoSummary}</span>
      <span>중계축 {relayCount}</span>
    </fieldset>
  )
}
