from __future__ import annotations

from typing import Final

from d4d_mission.capability import effective_capability
from d4d_mission.models import (
    CapabilityGap,
    DashboardState,
    EventRequest,
    KpiDelta,
    MicroAction,
    RecommendationCard,
)
from d4d_mission.types import CapabilityName, MicroActionType, VehicleStatus

CRITICAL_SEVERITY_THRESHOLD: Final = 0.85
_NO_EXCLUDE: Final[frozenset[str]] = frozenset()


def make_card(  # noqa: PLR0913
    card_id: str,
    title: str,
    causes: tuple[str, ...],
    event: EventRequest,
    actions: tuple[MicroAction, ...],
    gap: CapabilityGap | None = None,
) -> RecommendationCard:
    scale = gap.deficit_ratio if gap is not None else event.severity
    critical = event.severity >= CRITICAL_SEVERITY_THRESHOLD or (
        gap is not None and gap.deficit_ratio >= CRITICAL_SEVERITY_THRESHOLD
    )
    return RecommendationCard(
        id=card_id,
        severity="critical" if critical else "high",
        title=title,
        causes=causes,
        actions=actions,
        expected_effect=KpiDelta(
            mcc_delta=round(0.06 + (0.18 * scale), 3),
            collapse_probability_delta=round(-0.12 - (0.3 * scale), 3),
            autonomy_debt_delta=round(-12 - (30 * scale), 1),
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


def best_vehicle_for(
    snapshot: DashboardState,
    capability: CapabilityName,
    *,
    exclude: frozenset[str] = _NO_EXCLUDE,
    prefer_area: str | None = None,
    fallback: str = "UxV-06",
) -> str:
    candidates = [
        vehicle
        for vehicle in snapshot.vehicles
        if vehicle.status != VehicleStatus.LOST
        and not vehicle.synthetic
        and vehicle.id != "system"
        and vehicle.id not in exclude
    ]
    if len(candidates) == 0:
        return fallback
    candidates.sort(
        key=lambda vehicle: (
            effective_capability(vehicle).value_for(capability),
            1 if prefer_area is not None and vehicle.area == prefer_area else 0,
        ),
        reverse=True,
    )
    return candidates[0].id
