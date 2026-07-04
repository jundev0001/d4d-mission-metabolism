import { BarChart3 } from "lucide-react"
import { formatPercent } from "../format"
import { useMissionStore } from "../store"

export function EvaluationPanel() {
  const dashboard = useMissionStore((state) => state.dashboard)
  if (!dashboard) {
    return null
  }

  const assisted = dashboard.metrics.operator_actions
  const baseline = dashboard.baseline_metrics
  const collapseReduction = Math.max(
    0,
    baseline.collapse_probability - dashboard.metrics.collapse_probability,
  )

  return (
    <section className="panel evaluation-panel" data-testid="evaluation-panel">
      <div className="panel-title">
        <span>기준 대비 지원</span>
        <BarChart3 size={16} aria-hidden="true" />
      </div>
      <table className="comparison-table">
        <thead>
          <tr>
            <th scope="col">지표</th>
            <th scope="col">기준</th>
            <th scope="col">지원</th>
          </tr>
        </thead>
        <tbody>
          <ComparisonMetric
            label="운용자 조작"
            baseline={`${baseline.operator_actions}`}
            assisted={`${assisted}`}
          />
          <ComparisonMetric
            label="재계획 시간"
            baseline={`${baseline.replan_time_seconds.toFixed(0)}s`}
            assisted={`${dashboard.metrics.replan_time_seconds.toFixed(0)}s`}
          />
          <ComparisonMetric
            label="붕괴 위험"
            baseline={formatPercent(baseline.collapse_probability)}
            assisted={formatPercent(dashboard.metrics.collapse_probability)}
          />
          <ComparisonMetric
            label="위험 감소"
            baseline="0pp"
            assisted={`${Math.round(collapseReduction * 100)}pp`}
          />
        </tbody>
      </table>
      <div className="ccr-band">
        <span>CCR</span>
        <strong>
          {dashboard.metrics.ccr_external.toFixed(1)}x / {dashboard.metrics.ccr_internal.toFixed(1)}
          x
        </strong>
        <span>외부 / 내부 CCR</span>
      </div>
    </section>
  )
}

function ComparisonMetric(props: {
  readonly label: string
  readonly baseline: string
  readonly assisted: string
}) {
  return (
    <tr>
      <th scope="row">{props.label}</th>
      <td>{props.baseline}</td>
      <td>
        <strong>{props.assisted}</strong>
      </td>
    </tr>
  )
}
