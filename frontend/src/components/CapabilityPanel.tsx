import { capabilityLabel, formatPercent } from "../format"
import { useMissionStore } from "../store"
import { type CapabilityName, CapabilityNames } from "../types"

export function CapabilityPanel() {
  const report = useMissionStore((state) => state.dashboard?.capability_report)
  if (!report) {
    return null
  }

  return (
    <section className="panel capability-panel" data-testid="capability-panel">
      <div className="panel-title">
        <span>능력 예산</span>
        <span className="mono">{formatPercent(report.overall_mcc)}</span>
      </div>
      <div className="area-stack">
        {Object.values(report.area_reports).map((area) => (
          <article className="area-card" key={area.area}>
            <div className="area-header">
              <span>구역 {area.area}</span>
              <span className="caption">수요 대비 충족률</span>
            </div>
            {CapabilityNames.map((capability) => (
              <CapabilityRow
                key={`${area.area}-${capability}`}
                capability={capability}
                value={area.coverage[capability] ?? 0}
                deficit={area.deficit[capability] ?? 0}
              />
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}

type CapabilityRowProps = {
  readonly capability: CapabilityName
  readonly value: number
  readonly deficit: number
}

function CapabilityRow(props: CapabilityRowProps) {
  const tone = props.deficit > 0.2 ? "deficit" : props.value >= 0.85 ? "satisfied" : "strained"
  return (
    <div className={`capability-row ${tone}`}>
      <div className="capability-label">
        <span>{capabilityLabel(props.capability)}</span>
        <span className="mono">{formatPercent(props.value)}</span>
      </div>
      <meter
        aria-label={`${capabilityLabel(props.capability)} 충족률`}
        className="meter"
        max={100}
        min={0}
        value={Math.round(props.value * 100)}
      />
    </div>
  )
}
