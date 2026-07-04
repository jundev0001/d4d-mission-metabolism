import { BarChart3 } from "lucide-react"
import { formatPercent } from "../format"
import { useMissionStore } from "../store"

export function EvaluationPanel() {
  const dashboard = useMissionStore((state) => state.dashboard)
  if (!dashboard) {
    return null
  }

  const assisted = dashboard.metrics.operator_actions
  const baseline = dashboard.baseline_operator_actions
  const collapseReduction = Math.max(0, 0.64 - dashboard.metrics.collapse_probability)

  return (
    <section className="panel evaluation-panel" data-testid="evaluation-panel">
      <div className="panel-title">
        <span>A/B Evaluation</span>
        <BarChart3 size={16} aria-hidden="true" />
      </div>
      <div className="comparison-grid">
        <ComparisonMetric
          label="Operator actions"
          baseline={`${baseline}`}
          assisted={`${assisted}`}
        />
        <ComparisonMetric
          label="Replan time"
          baseline="46s"
          assisted={`${dashboard.metrics.replan_time_seconds.toFixed(0)}s`}
        />
        <ComparisonMetric
          label="Collapse risk"
          baseline="64%"
          assisted={formatPercent(dashboard.metrics.collapse_probability)}
        />
        <ComparisonMetric
          label="Risk reduced"
          baseline="0pp"
          assisted={`${Math.round(collapseReduction * 100)}pp`}
        />
      </div>
      <div className="ccr-band">
        <span>CCR internal</span>
        <strong>{dashboard.metrics.ccr_internal.toFixed(1)}x</strong>
        <span>System micro-actions per human intent</span>
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
    <article className="comparison-card">
      <span>{props.label}</span>
      <div>
        <small>Baseline {props.baseline}</small>
        <strong>Assisted {props.assisted}</strong>
      </div>
    </article>
  )
}
