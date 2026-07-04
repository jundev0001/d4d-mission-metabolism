from __future__ import annotations

from dataclasses import dataclass
from typing import override

from d4d_mission.immune_actions import (
    DecisionImpact,
    apply_card_actions,
    apply_micro_action,
    set_recommendation_status,
)
from d4d_mission.models import (
    DashboardState,
    DecisionRequest,
    MicroAction,
    RecommendationCard,
)
from d4d_mission.types import DecisionAction, RecommendationStatus


@dataclass(frozen=True, slots=True)
class RecommendationNotFoundError(Exception):
    recommendation_id: str

    @override
    def __str__(self) -> str:
        return f"recommendation {self.recommendation_id} not found"


@dataclass(frozen=True, slots=True)
class ManualActionError(Exception):
    recommendation_id: str

    @override
    def __str__(self) -> str:
        return f"manual action for {self.recommendation_id} requires vehicle_id and manual_action"


def decide_recommendation(snapshot: DashboardState, request: DecisionRequest) -> DashboardState:
    card = find_recommendation(snapshot=snapshot, recommendation_id=request.recommendation_id)
    if request.action == DecisionAction.APPROVE:
        updated = apply_card_actions(snapshot=snapshot, card=card)
        return set_recommendation_status(
            snapshot=updated,
            card=card,
            status=RecommendationStatus.APPROVED,
            impact=DecisionImpact(
                operator_delta=1,
                micro_delta=len(card.actions),
                recovery_delta=len(card.actions),
                replan_seconds=11.0,
            ),
        )
    if request.action == DecisionAction.REJECT:
        return set_recommendation_status(
            snapshot=snapshot,
            card=card,
            status=RecommendationStatus.REJECTED,
            impact=DecisionImpact(
                operator_delta=1,
                micro_delta=0,
                recovery_delta=0,
                replan_seconds=4.0,
            ),
        )
    return _manual_decision(snapshot=snapshot, request=request, card=card)


def find_recommendation(snapshot: DashboardState, recommendation_id: str) -> RecommendationCard:
    for card in snapshot.recommendations:
        if card.id == recommendation_id:
            return card
    raise RecommendationNotFoundError(recommendation_id=recommendation_id)


def _manual_decision(
    snapshot: DashboardState,
    request: DecisionRequest,
    card: RecommendationCard,
) -> DashboardState:
    if request.vehicle_id is None or request.manual_action is None:
        raise ManualActionError(recommendation_id=request.recommendation_id)
    vehicle_area = next(
        (vehicle.area for vehicle in snapshot.vehicles if vehicle.id == request.vehicle_id),
        snapshot.mission.areas[0],
    )
    manual = MicroAction(
        vehicle_id=request.vehicle_id,
        action=request.manual_action,
        area=vehicle_area,
        rationale="manual operator override from safe action list",
    )
    vehicles, assignments = apply_micro_action(
        vehicles=snapshot.vehicles,
        assignments=snapshot.assignments,
        action=manual,
    )
    updated = snapshot.model_copy(update={"vehicles": vehicles, "assignments": assignments})
    return set_recommendation_status(
        snapshot=updated,
        card=card,
        status=RecommendationStatus.MANUAL,
        impact=DecisionImpact(
            operator_delta=3,
            micro_delta=1,
            recovery_delta=1,
            replan_seconds=19.0,
        ),
    )
