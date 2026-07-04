import { Check, Hand, ListChecks, X } from "lucide-react"
import { formatSignedNumber, formatSignedPercent } from "../format"
import { useMissionStore } from "../store"
import type { DecisionAction, DecisionPayload, MicroActionType, RecommendationCard } from "../types"

const EMPTY_RECOMMENDATIONS: readonly RecommendationCard[] = []

function buildDecisionPayload(
  recommendationId: string,
  action: DecisionAction,
  manualAction?: MicroActionType,
  vehicleId?: string,
): DecisionPayload {
  if (manualAction !== undefined && vehicleId !== undefined) {
    return {
      recommendation_id: recommendationId,
      action,
      manual_action: manualAction,
      vehicle_id: vehicleId,
    }
  }

  return {
    recommendation_id: recommendationId,
    action,
  }
}

export function RecommendationPanel() {
  const cards = useMissionStore(
    (state) => state.dashboard?.recommendations ?? EMPTY_RECOMMENDATIONS,
  )
  const decide = useMissionStore((state) => state.decide)

  return (
    <section className="panel recommendation-panel" data-testid="recommendation-panel">
      <div className="panel-title">
        <span>Recommendation Cards</span>
        <span className="caption">{cards.length} total</span>
      </div>
      <div className="recommendation-list">
        {cards.length === 0 ? (
          <div className="empty-state">
            <ListChecks size={18} aria-hidden="true" />
            <span>No pending exceptions</span>
          </div>
        ) : (
          cards.map((card) => (
            <RecommendationCardView
              key={card.id}
              card={card}
              onDecision={(action, manualAction, vehicleId) =>
                void decide(buildDecisionPayload(card.id, action, manualAction, vehicleId))
              }
            />
          ))
        )}
      </div>
    </section>
  )
}

type RecommendationCardViewProps = {
  readonly card: RecommendationCard
  readonly onDecision: (
    action: DecisionAction,
    manualAction?: MicroActionType,
    vehicleId?: string,
  ) => void
}

export function RecommendationCardView(props: RecommendationCardViewProps) {
  const firstVehicle = props.card.actions[0]?.vehicle_id ?? "UxV-06"

  return (
    <article
      className={`recommendation-card ${props.card.severity} ${props.card.status}`}
      data-testid="recommendation-card"
    >
      <div className="card-heading">
        <div>
          <span className="severity">{props.card.severity}</span>
          <h3>{props.card.title}</h3>
        </div>
        <span className="status-pill">{props.card.status}</span>
      </div>
      <div className="chip-row">
        {props.card.causes.map((cause) => (
          <span className="chip" key={cause}>
            {cause.replaceAll("_", " ")}
          </span>
        ))}
      </div>
      <ul className="action-list">
        {props.card.actions.map((action) => (
          <li key={`${props.card.id}-${action.vehicle_id}-${action.action}`}>
            <strong>{action.vehicle_id}</strong>
            <span>{action.action.replaceAll("_", " ")}</span>
          </li>
        ))}
      </ul>
      <fieldset className="delta-grid">
        <legend className="sr-only">Expected KPI effect</legend>
        <span>MCC {formatSignedPercent(props.card.expected_effect.mcc_delta)}</span>
        <span>
          Collapse {formatSignedPercent(props.card.expected_effect.collapse_probability_delta)}
        </span>
        <span>Debt {formatSignedNumber(props.card.expected_effect.autonomy_debt_delta)}</span>
      </fieldset>
      <div className="decision-row">
        <button
          className="button primary"
          type="button"
          disabled={props.card.status !== "pending"}
          onClick={() => props.onDecision("approve")}
        >
          <Check size={14} aria-hidden="true" />
          Approve
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={props.card.status !== "pending"}
          onClick={() => props.onDecision("manual", "replace", firstVehicle)}
        >
          <Hand size={14} aria-hidden="true" />
          Manual
        </button>
        <button
          className="button danger"
          type="button"
          disabled={props.card.status !== "pending"}
          onClick={() => props.onDecision("reject")}
        >
          <X size={14} aria-hidden="true" />
          Reject
        </button>
      </div>
    </article>
  )
}
