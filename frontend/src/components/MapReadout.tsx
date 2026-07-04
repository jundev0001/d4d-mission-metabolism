import type { CustomMapArea } from "../customScenario"
import { formatPercent, missionTypeLabel, targetLabel } from "../format"
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
      {mapAreas.map((area) => {
        const missionLabel = missionTypeLabel(
          dashboard.mission.area_mission_types[area.id] ?? dashboard.mission.mission_type,
        )
        const priority = formatPercent(dashboard.mission.area_priorities[area.id] ?? 0)
        const coverage = formatPercent(minimumCoverageForArea(dashboard, area.id))
        const summary = `${area.label} ${missionLabel} · 우선순위 ${priority} · 최저 ${coverage}`
        return (
          <span className="area-coverage-chip" key={area.id} title={summary}>
            <strong>{area.label}</strong>
            <span className="area-coverage-mission">{missionLabel}</span>
            <span className="area-coverage-metrics">
              우선순위 {priority} · 최저 {coverage}
            </span>
          </span>
        )
      })}
      <span>EW 최고 {formatPercent(strongestThreat)}</span>
      <span>No-go {noGoSummary}</span>
      <span>중계축 {relayCount}</span>
    </fieldset>
  )
}
