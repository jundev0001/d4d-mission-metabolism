import { Activity, Gauge, RadioTower, Scale } from "lucide-react"
import { formatPercent } from "../format"
import { useMissionStore } from "../store"
import type { MetricSnapshot } from "../types"

type MetricCardProps = {
  readonly label: string
  readonly value: string
  readonly context: string
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
    <section className="metric-strip" aria-label="임무 메타볼리즘" data-testid="metric-strip">
      <MetricCard
        label="임무 능력"
        value={formatPercent(metrics.mcc)}
        context="목표 80%"
        tone={mccTone(metrics)}
        progress={metrics.mcc}
        icon={<Gauge size={16} aria-hidden="true" />}
      />
      <MetricCard
        label="붕괴 위험"
        value={formatPercent(metrics.collapse_probability)}
        context="단기 예측"
        tone={metrics.collapse_probability > 0.55 ? "danger" : "warning"}
        progress={metrics.collapse_probability}
        icon={<Activity size={16} aria-hidden="true" />}
      />
      <MetricCard
        label="자율성 부채"
        value={`${Math.round(metrics.autonomy_debt)}`}
        context={`경보 대기 ${metrics.alert_backlog}`}
        tone={metrics.autonomy_debt > 55 ? "danger" : "info"}
        progress={metrics.autonomy_debt / 100}
        icon={<Scale size={16} aria-hidden="true" />}
      />
      <MetricCard
        label="CCR 외부"
        value={`${metrics.ccr_external.toFixed(1)}x`}
        context={`운용자 조작 ${metrics.operator_actions}`}
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
      <span className="metric-context">{props.context}</span>
      <meter
        aria-label={`${props.label} 진행률`}
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
