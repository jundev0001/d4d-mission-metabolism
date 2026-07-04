from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from d4d_mission.allocator import plan_allocation
from d4d_mission.decay import HORIZON_STEPS, project_vehicle
from d4d_mission.immune_actions import apply_micro_action
from d4d_mission.immune_card_helpers import card_action
from d4d_mission.models import (
    Assignment,
    DashboardState,
    KpiDelta,
    MicroAction,
    RecommendationCard,
    Vehicle,
)
from d4d_mission.scenario import refresh_snapshot
from d4d_mission.types import MicroActionType, VehicleStatus

PREDICTED_BATTERY_CAUSE: Final = "predicted_battery_drop"
BATTERY_ROTATION_GUARD: Final = 0.04


@dataclass(frozen=True, slots=True)
class _BatteryRisk:
    vehicle: Vehicle
    assignment: Assignment
    projected_battery: float
    margin: float


def add_battery_rotation_recommendation(snapshot: DashboardState) -> DashboardState:
    card = build_battery_rotation_recommendation(snapshot=snapshot)
    if card is None:
        return snapshot
    return refresh_snapshot(
        snapshot=snapshot.model_copy(update={"recommendations": (card, *snapshot.recommendations)}),
    )


def build_battery_rotation_recommendation(
    snapshot: DashboardState,
) -> RecommendationCard | None:
    if _has_pending_rotation(snapshot):
        return None
    risk = _top_battery_risk(
        snapshot=snapshot,
        exclude=_existing_rotation_targets(snapshot),
    )
    if risk is None:
        return None

    replacement = _replacement_assignment(snapshot=snapshot, risk=risk)
    actions = (
        card_action(
            risk.vehicle.id,
            MicroActionType.RETURN,
            None,
            "return before projected battery crosses the recovery threshold",
        ),
        *_replacement_or_human_gate(replacement=replacement, area=risk.assignment.area),
    )
    preview = _preview_actions(snapshot=snapshot, actions=actions)
    return RecommendationCard(
        id=_next_card_id(snapshot=snapshot),
        severity="critical" if risk.margin <= 0 else "high",
        title=f"{risk.vehicle.id} proactive battery rotation",
        causes=(
            PREDICTED_BATTERY_CAUSE,
            "battery_horizon",
            "reserve_rotation",
        ),
        actions=actions,
        expected_effect=_kpi_delta(before=snapshot, after=preview, actions=actions),
    )


def battery_margin_after_horizon(
    vehicle: Vehicle,
    snapshot: DashboardState,
    area: str,
    horizon: int = HORIZON_STEPS,
) -> float:
    projected = project_vehicle(
        vehicle=vehicle,
        mission=snapshot.mission,
        area=area,
        steps=horizon,
    )
    return projected.health.battery - snapshot.mission.constraints.return_battery_threshold


def is_battery_viable_replacement(
    vehicle: Vehicle,
    snapshot: DashboardState,
    area: str,
) -> bool:
    return battery_margin_after_horizon(
        vehicle=vehicle,
        snapshot=snapshot,
        area=area,
    ) > BATTERY_ROTATION_GUARD


def _top_battery_risk(
    snapshot: DashboardState,
    exclude: frozenset[str],
) -> _BatteryRisk | None:
    risks = tuple(
        risk for risk in _battery_risks(snapshot=snapshot) if risk.vehicle.id not in exclude
    )
    if len(risks) == 0:
        return None
    return min(
        risks,
        key=lambda risk: (
            risk.margin,
            -snapshot.mission.area_priorities.get(risk.assignment.area, 0.0),
        ),
    )


def _battery_risks(snapshot: DashboardState) -> tuple[_BatteryRisk, ...]:
    vehicles_by_id = {vehicle.id: vehicle for vehicle in snapshot.vehicles}
    threshold = snapshot.mission.constraints.return_battery_threshold
    risks: list[_BatteryRisk] = []
    for assignment in snapshot.assignments:
        vehicle = vehicles_by_id.get(assignment.vehicle_id)
        if vehicle is None or vehicle.status != VehicleStatus.ACTIVE:
            continue
        margin = battery_margin_after_horizon(
            vehicle=vehicle,
            snapshot=snapshot,
            area=assignment.area,
        )
        if margin <= BATTERY_ROTATION_GUARD:
            risks.append(
                _BatteryRisk(
                    vehicle=vehicle,
                    assignment=assignment,
                    projected_battery=threshold + margin,
                    margin=margin,
                ),
            )
    return tuple(risks)


def _replacement_assignment(snapshot: DashboardState, risk: _BatteryRisk) -> Assignment | None:
    returning_vehicles = tuple(
        vehicle.model_copy(update={"status": VehicleStatus.RETURNING})
        if vehicle.id == risk.vehicle.id
        else vehicle
        for vehicle in snapshot.vehicles
    )
    plan = plan_allocation(vehicles=returning_vehicles, mission=snapshot.mission)
    current = {assignment.vehicle_id: assignment for assignment in snapshot.assignments}
    for assignment in plan.assignments:
        if assignment.vehicle_id == risk.vehicle.id or assignment.area != risk.assignment.area:
            continue
        vehicle = _vehicle_by_id(vehicles=returning_vehicles, vehicle_id=assignment.vehicle_id)
        if (
            vehicle is None
            or vehicle.status == VehicleStatus.LOST
            or not is_battery_viable_replacement(
                vehicle=vehicle,
                snapshot=snapshot,
                area=assignment.area,
            )
        ):
            continue
        current_assignment = current.get(assignment.vehicle_id)
        if (
            current_assignment is None
            or current_assignment.area != assignment.area
            or vehicle.status == VehicleStatus.STANDBY
            or vehicle.area == "GCS"
        ):
            return assignment
    return _best_standby_replacement(
        snapshot=snapshot,
        vehicles=returning_vehicles,
        target=risk.vehicle.id,
        area=risk.assignment.area,
    )


def _best_standby_replacement(
    snapshot: DashboardState,
    vehicles: tuple[Vehicle, ...],
    target: str,
    area: str,
) -> Assignment | None:
    candidates = [
        vehicle
        for vehicle in vehicles
        if vehicle.id != target and vehicle.status == VehicleStatus.STANDBY
        and is_battery_viable_replacement(vehicle=vehicle, snapshot=snapshot, area=area)
    ]
    if len(candidates) == 0:
        return None
    reserve = max(candidates, key=lambda vehicle: vehicle.capabilities.reserve)
    return Assignment(vehicle_id=reserve.id, area=area, role=reserve.role)


def _replacement_or_human_gate(
    replacement: Assignment | None,
    area: str,
) -> tuple[MicroAction, ...]:
    if replacement is None:
        return (
            card_action(
                "system",
                MicroActionType.REQUEST_HUMAN_CONFIRM,
                area,
                "confirm objective reduction because no reserve can rotate in",
            ),
        )
    return (
        card_action(
            replacement.vehicle_id,
            MicroActionType.REPLACE,
            replacement.area,
            "rotate reserve in before the active asset crosses return threshold",
        ),
    )


def _preview_actions(
    snapshot: DashboardState,
    actions: tuple[MicroAction, ...],
) -> DashboardState:
    vehicles = snapshot.vehicles
    assignments = snapshot.assignments
    for action in actions:
        vehicles, assignments = apply_micro_action(
            vehicles=vehicles,
            assignments=assignments,
            action=action,
        )
    return refresh_snapshot(
        snapshot=snapshot.model_copy(update={"vehicles": vehicles, "assignments": assignments}),
    )


def _kpi_delta(
    before: DashboardState,
    after: DashboardState,
    actions: tuple[MicroAction, ...],
) -> KpiDelta:
    return KpiDelta(
        mcc_delta=round(after.metrics.mcc - before.metrics.mcc, 3),
        collapse_probability_delta=round(
            after.metrics.collapse_probability - before.metrics.collapse_probability,
            3,
        ),
        autonomy_debt_delta=round(after.metrics.autonomy_debt - before.metrics.autonomy_debt, 1),
        operator_actions_delta=-(max(1, len(actions) * 3)),
    )


def _existing_rotation_targets(snapshot: DashboardState) -> frozenset[str]:
    return frozenset(
        action.vehicle_id
        for card in snapshot.recommendations
        if PREDICTED_BATTERY_CAUSE in card.causes
        for action in card.actions
        if action.action == MicroActionType.RETURN
    )


def _has_pending_rotation(snapshot: DashboardState) -> bool:
    return any(
        PREDICTED_BATTERY_CAUSE in card.causes and card.status == "pending"
        for card in snapshot.recommendations
    )


def _next_card_id(snapshot: DashboardState) -> str:
    return f"rec-{len(snapshot.recommendations) + len(snapshot.events) + 1:03d}"


def _vehicle_by_id(vehicles: tuple[Vehicle, ...], vehicle_id: str) -> Vehicle | None:
    return next((vehicle for vehicle in vehicles if vehicle.id == vehicle_id), None)
