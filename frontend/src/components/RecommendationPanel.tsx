import { Check, Hand, History, ListChecks, X } from "lucide-react"
import {
  areaLabel,
  causeLabel,
  formatSignedNumber,
  formatSignedPercent,
  microActionLabel,
  recommendationTitleLabel,
  statusLabel,
} from "../format"
import { useMissionStore } from "../store"
import type { DecisionAction, DecisionPayload, MicroActionType, RecommendationCard } from "../types"

const EMPTY_RECOMMENDATIONS: readonly RecommendationCard[] = []
const SEVERITY_PRIORITY: Readonly<Record<string, number>> = {
  critical: 0,
  high: 1,
}

type ResolvedRecommendationCard = RecommendationCard & {
  readonly status: Exclude<RecommendationCard["status"], "pending">
}

function isPendingCard(card: RecommendationCard): boolean {
  return card.status === "pending"
}

function isResolvedCard(card: RecommendationCard): card is ResolvedRecommendationCard {
  return card.status !== "pending"
}

function comparePendingCards(left: RecommendationCard, right: RecommendationCard): number {
  return severityPriority(left) - severityPriority(right)
}

function severityPriority(card: RecommendationCard): number {
  return SEVERITY_PRIORITY[card.severity] ?? 2
}

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
  const pendingCards = cards.filter(isPendingCard).toSorted(comparePendingCards)
  const resolvedCards = cards.filter(isResolvedCard).toReversed()

  return (
    <section className="panel recommendation-panel" data-testid="recommendation-panel">
      <div className="panel-title">
        <span>판단 대기열</span>
        <span className="caption">
          대기 {pendingCards.length} / 전체 {cards.length}
        </span>
      </div>
      <div className="recommendation-list" data-testid="recommendation-queue">
        {pendingCards.length === 0 ? (
          <div className="empty-state">
            <ListChecks size={18} aria-hidden="true" />
            <span>사람 승인 대기 없음</span>
          </div>
        ) : (
          pendingCards.map((card) => (
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
      <DecisionHistory cards={resolvedCards} />
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
  const causes = props.card.causes.map(causeLabel).join(" / ")

  return (
    <article
      className={`recommendation-card ${props.card.severity} ${props.card.status}`}
      data-testid="recommendation-card"
    >
      <div className="card-heading">
        <div>
          <span className="severity">{statusLabel(props.card.severity)}</span>
          <h3>{recommendationTitleLabel(props.card.title)}</h3>
        </div>
        <span className="status-pill">{statusLabel(props.card.status)}</span>
      </div>
      <p className="cause-line">
        <span>원인</span>
        {causes}
      </p>
      <ul className="action-list">
        {props.card.actions.map((action) => (
          <li key={`${props.card.id}-${action.vehicle_id}-${action.action}`}>
            <strong>{action.vehicle_id}</strong>
            <span>
              {microActionLabel(action.action)}
              {action.area ? ` / ${areaLabel(action.area)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <fieldset className="delta-grid">
        <legend className="sr-only">예상 KPI 변화</legend>
        <span>
          <b>MCC</b> {formatSignedPercent(props.card.expected_effect.mcc_delta)}
        </span>
        <span>
          <b>붕괴</b> {formatSignedPercent(props.card.expected_effect.collapse_probability_delta)}
        </span>
        <span>
          <b>부채</b> {formatSignedNumber(props.card.expected_effect.autonomy_debt_delta)}
        </span>
      </fieldset>
      <div className="decision-row">
        <button
          className="button primary"
          type="button"
          disabled={props.card.status !== "pending"}
          onClick={() => props.onDecision("approve")}
        >
          <Check size={14} aria-hidden="true" />
          승인
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={props.card.status !== "pending"}
          onClick={() => props.onDecision("manual", "replace", firstVehicle)}
        >
          <Hand size={14} aria-hidden="true" />
          수동
        </button>
        <button
          className="button danger"
          type="button"
          disabled={props.card.status !== "pending"}
          onClick={() => props.onDecision("reject")}
        >
          <X size={14} aria-hidden="true" />
          거절
        </button>
      </div>
    </article>
  )
}

type DecisionHistoryProps = {
  readonly cards: readonly ResolvedRecommendationCard[]
}

function DecisionHistory(props: DecisionHistoryProps) {
  return (
    <section className="decision-history" aria-label="판단 로그" data-testid="decision-history">
      <div className="decision-history-title">
        <span>판단 로그</span>
        <span className="caption">{props.cards.length}개 처리</span>
      </div>
      {props.cards.length === 0 ? (
        <div className="decision-history-empty">
          <History size={16} aria-hidden="true" />
          <span>처리된 판단 없음</span>
        </div>
      ) : (
        <ol className="decision-history-list">
          {props.cards.map((card) => (
            <li className={`decision-history-row ${card.status}`} key={card.id}>
              <span className="status-pill">{statusLabel(card.status)}</span>
              <span>{recommendationTitleLabel(card.title)}</span>
              <span className="caption">{card.actions.length}개 조치</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
