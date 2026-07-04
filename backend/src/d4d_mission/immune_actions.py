from __future__ import annotations

from dataclasses import dataclass

from d4d_mission.capability import clamp01
from d4d_mission.metabolism import evaluate_metrics
from d4d_mission.models import (
    Assignment,
    DashboardState,
    MicroAction,
    RecommendationCard,
    Vehicle,
)
from d4d_mission.types import (
    CapabilityName,
    MicroActionType,
    RecommendationStatus,
    VehicleStatus,
)


@dataclass(frozen=True, slots=True)
class DecisionImpact:
    operator_delta: int
    micro_delta: int
    recovery_delta: int
    replan_seconds: float


def apply_card_actions(snapshot: DashboardState, card: RecommendationCard) -> DashboardState:
    vehicles = snapshot.vehicles
    assignments = snapshot.assignments
    for action in card.actions:
        vehicles, assignments = apply_micro_action(
            vehicles=vehicles,
            assignments=assignments,
            action=action,
        )
    return snapshot.model_copy(update={"vehicles": vehicles, "assignments": assignments})


def apply_micro_action(
    vehicles: tuple[Vehicle, ...],
    assignments: tuple[Assignment, ...],
    action: MicroAction,
) -> tuple[tuple[Vehicle, ...], tuple[Assignment, ...]]:
    if action.action == MicroActionType.RETURN:
        returning = _set_vehicle_status(vehicles, action.vehicle_id, VehicleStatus.RETURNING)
        return returning, assignments
    if action.action == MicroActionType.REPLACE:
        return _activate_replacement(vehicles, action), _assign_vehicle(assignments, action)
    if action.action in {MicroActionType.REPOSITION_RELAY, MicroActionType.REDISTRIBUTE_COVERAGE}:
        return _move_vehicle(vehicles, action), _assign_vehicle(assignments, action)
    if action.action == MicroActionType.LAUNCH_RESERVE:
        return _activate_replacement(vehicles, action), _assign_vehicle(assignments, action)
    if action.action in {MicroActionType.REROUTE, MicroActionType.DECONFLICT_PATHS}:
        return _reroute_vehicle(vehicles, action), _assign_vehicle(assignments, action)
    if action.action in {MicroActionType.REASSIGN_ROLE, MicroActionType.HANDOFF_TARGET}:
        return _reassign_vehicle(vehicles, action), _assign_vehicle(assignments, action)
    if action.action == MicroActionType.SWITCH_SENSOR_MODE:
        return _improve_sensor_confidence(vehicles, action.vehicle_id), assignments
    if action.action == MicroActionType.SYNC_DATA:
        return _sync_vehicle_data(vehicles, action.vehicle_id), assignments
    if action.action == MicroActionType.LOW_BANDWIDTH:
        return _improve_comm(vehicles, action.vehicle_id), assignments
    if action.action == MicroActionType.HOLD:
        standby = _set_vehicle_status(vehicles, action.vehicle_id, VehicleStatus.STANDBY)
        return standby, assignments
    if action.action in {
        MicroActionType.SUPPRESS_ALERTS,
        MicroActionType.MARK_AREA_STALE,
        MicroActionType.DOWNGRADE_OBJECTIVE,
        MicroActionType.REQUEST_HUMAN_CONFIRM,
    }:
        return vehicles, assignments
    return vehicles, assignments


def set_recommendation_status(
    snapshot: DashboardState,
    card: RecommendationCard,
    status: RecommendationStatus,
    impact: DecisionImpact,
) -> DashboardState:
    recommendations = tuple(
        item.model_copy(update={"status": status}) if item.id == card.id else item
        for item in snapshot.recommendations
    )
    updated = snapshot.model_copy(
        update={
            "recommendations": recommendations,
            "assisted_operator_actions": snapshot.assisted_operator_actions + impact.operator_delta,
            "system_micro_actions": snapshot.system_micro_actions + impact.micro_delta,
            "human_intents": snapshot.human_intents + 1,
            "recovery_actions": snapshot.recovery_actions + impact.recovery_delta,
            "metrics": snapshot.metrics.model_copy(
                update={"replan_time_seconds": impact.replan_seconds},
            ),
        },
    )
    pending_cards = sum(
        1 for item in recommendations if item.status == RecommendationStatus.PENDING
    )
    metrics = evaluate_metrics(snapshot=updated, pending_cards=pending_cards)
    return updated.model_copy(update={"metrics": metrics})


def _set_vehicle_status(
    vehicles: tuple[Vehicle, ...],
    vehicle_id: str,
    status: VehicleStatus,
) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(update={"status": status}) if vehicle.id == vehicle_id else vehicle
        for vehicle in vehicles
    )


def _activate_replacement(
    vehicles: tuple[Vehicle, ...],
    action: MicroAction,
) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(
            update={
                "status": VehicleStatus.ACTIVE,
                "area": action.area or vehicle.area,
                "role": CapabilityName.VISUAL_RECON,
                "position": vehicle.position.model_copy(update={"x": 52, "y": 49}),
            },
        )
        if vehicle.id == action.vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _move_vehicle(vehicles: tuple[Vehicle, ...], action: MicroAction) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(
            update={
                "area": action.area or vehicle.area,
                "role": CapabilityName.RELAY,
                "position": vehicle.position.model_copy(update={"x": 58, "y": 46}),
            },
        )
        if vehicle.id == action.vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _reroute_vehicle(vehicles: tuple[Vehicle, ...], action: MicroAction) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(
            update={
                "area": action.area or vehicle.area,
                "position": vehicle.position.model_copy(update={"x": 50, "y": 54}),
            },
        )
        if vehicle.id == action.vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _reassign_vehicle(vehicles: tuple[Vehicle, ...], action: MicroAction) -> tuple[Vehicle, ...]:
    role = _role_for_action(action)
    return tuple(
        vehicle.model_copy(
            update={
                "area": action.area or vehicle.area,
                "role": role,
                "position": vehicle.position.model_copy(update={"x": 56, "y": 42}),
            },
        )
        if vehicle.id == action.vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _improve_comm(vehicles: tuple[Vehicle, ...], vehicle_id: str) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(
            update={
                "health": vehicle.health.model_copy(
                    update={"comm": clamp01(vehicle.health.comm + 0.18)},
                ),
            },
        )
        if vehicle.id == vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _improve_sensor_confidence(
    vehicles: tuple[Vehicle, ...],
    vehicle_id: str,
) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(
            update={
                "health": vehicle.health.model_copy(
                    update={
                        "sensor": clamp01(vehicle.health.sensor + 0.12),
                        "confidence": clamp01(vehicle.health.confidence + 0.08),
                    },
                ),
            },
        )
        if vehicle.id == vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _sync_vehicle_data(vehicles: tuple[Vehicle, ...], vehicle_id: str) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(
            update={
                "health": vehicle.health.model_copy(
                    update={
                        "comm": clamp01(vehicle.health.comm + 0.08),
                        "confidence": clamp01(vehicle.health.confidence + 0.1),
                    },
                ),
            },
        )
        if vehicle.id == vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _assign_vehicle(
    assignments: tuple[Assignment, ...],
    action: MicroAction,
) -> tuple[Assignment, ...]:
    current_assignment = next(
        (assignment for assignment in assignments if assignment.vehicle_id == action.vehicle_id),
        None,
    )
    area = action.area or (current_assignment.area if current_assignment is not None else "B")
    next_assignment = Assignment(
        vehicle_id=action.vehicle_id,
        area=area,
        role=_role_for_action(action),
    )
    replaced = tuple(
        next_assignment if assignment.vehicle_id == action.vehicle_id else assignment
        for assignment in assignments
    )
    if any(assignment.vehicle_id == action.vehicle_id for assignment in assignments):
        return replaced
    return (*assignments, next_assignment)


def _role_for_action(action: MicroAction) -> CapabilityName:
    if action.action == MicroActionType.REPOSITION_RELAY:
        return CapabilityName.RELAY
    if action.action == MicroActionType.HANDOFF_TARGET:
        return CapabilityName.OVERWATCH
    if action.action == MicroActionType.REDISTRIBUTE_COVERAGE:
        return CapabilityName.RELAY
    return CapabilityName.VISUAL_RECON
