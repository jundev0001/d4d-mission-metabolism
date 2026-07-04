import { Activity, Gauge, RadioTower, Scale } from "lucide-react"
import { formatPercent } from "../format"
import { useMissionStore } from "../store"
import type { MetricSnapshot } from "../types"

type MetricCardProps = {
  readonly label: string
  readonly value: string
  readonly tone: "success" | "warning" | "danger" | "info"
  readonly progress: number
  readonly icon: React.ReactNode
}

export function MetricStrip() {
  const metrics = useMissionStore((state) => state.dashboard?.metrics)
  if (!metrics) {
    return null
  }

  return (
    <section className="metric-strip" aria-label="Mission metabolism" data-testid="metric-strip">
      <MetricCard
        label="Mission Capability Coverage"
        value={formatPercent(metrics.mcc)}
        tone={mccTone(metrics)}
        progress={metrics.mcc}
        icon={<Gauge size={16} aria-hidden="true" />}
      />
      <MetricCard
        label="Collapse Probability"
        value={formatPercent(metrics.collapse_probability)}
        tone={metrics.collapse_probability > 0.55 ? "danger" : "warning"}
        progress={metrics.collapse_probability}
        icon={<Activity size={16} aria-hidden="true" />}
      />
      <MetricCard
        label="Autonomy Debt"
        value={`${Math.round(metrics.autonomy_debt)}`}
        tone={metrics.autonomy_debt > 55 ? "danger" : "info"}
        progress={metrics.autonomy_debt / 100}
        icon={<Scale size={16} aria-hidden="true" />}
      />
      <MetricCard
        label="CCR External"
        value={`${metrics.ccr_external.toFixed(1)}x`}
        tone="success"
        progress={Math.min(metrics.ccr_external / 8, 1)}
        icon={<RadioTower size={16} aria-hidden="true" />}
      />
    </section>
  )
}

function MetricCard(props: MetricCardProps) {
  return (
    <article className={`metric-card ${props.tone}`}>
      <div className="metric-heading">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <strong className="metric-value">{props.value}</strong>
      <meter
        aria-label={`${props.label} progress`}
        className="meter"
        max={100}
        min={0}
        value={Math.round(props.progress * 100)}
      />
    </article>
  )
}

function mccTone(metrics: MetricSnapshot): MetricCardProps["tone"] {
  if (metrics.mcc >= 0.8) {
    return "success"
  }
  if (metrics.mcc >= 0.65) {
    return "warning"
  }
  return "danger"
}
