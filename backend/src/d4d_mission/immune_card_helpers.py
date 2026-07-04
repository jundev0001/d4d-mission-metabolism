from __future__ import annotations

from typing import Final

from d4d_mission.models import (
    DashboardState,
    EventRequest,
    KpiDelta,
    MicroAction,
    RecommendationCard,
)
from d4d_mission.types import CapabilityName, MicroActionType, VehicleStatus

CRITICAL_SEVERITY_THRESHOLD: Final = 0.85


def make_card(
    card_id: str,
    title: str,
    causes: tuple[str, ...],
    event: EventRequest,
    actions: tuple[MicroAction, ...],
) -> RecommendationCard:
    severity = "critical" if event.severity >= CRITICAL_SEVERITY_THRESHOLD else "high"
    return RecommendationCard(
        id=card_id,
        severity=severity,
        title=title,
        causes=causes,
        actions=actions,
        expected_effect=KpiDelta(
            mcc_delta=round(0.1 + (event.severity * 0.09), 3),
            collapse_probability_delta=round(-0.18 - (event.severity * 0.18), 3),
            autonomy_debt_delta=round(-16 - (event.severity * 18), 1),
            operator_actions_delta=-(max(1, len(actions) * 3)),
        ),
    )


def card_action(
    vehicle_id: str,
    action: MicroActionType,
    area: str | None,
    rationale: str,
) -> MicroAction:
    return MicroAction(vehicle_id=vehicle_id, action=action, area=area, rationale=rationale)


def best_vehicle_for(snapshot: DashboardState, capability: CapabilityName, fallback: str) -> str:
    candidates = sorted(
        (
            vehicle
            for vehicle in snapshot.vehicles
            if vehicle.status != VehicleStatus.LOST and vehicle.id != "system"
        ),
        key=lambda vehicle: vehicle.capabilities.value_for(capability),
        reverse=True,
    )
    return fallback if len(candidates) == 0 else candidates[0].id
