from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from d4d_mission.allocator import plan_allocation
from d4d_mission.battery_rotation import is_battery_viable_replacement
from d4d_mission.capability import effective_capability
from d4d_mission.capability_gap import analyze_capability_gaps, top_gap
from d4d_mission.immune_actions import apply_micro_action
from d4d_mission.immune_card_helpers import card_action
from d4d_mission.models import (
    Assignment,
    DashboardState,
    EventRequest,
    KpiDelta,
    MetricSnapshot,
    MicroAction,
    RecommendationCard,
    Vehicle,
)
from d4d_mission.scenario import refresh_snapshot
from d4d_mission.scenario_events import apply_event_to_mission, apply_event_to_vehicle
from d4d_mission.types import CapabilityName, EventType, MicroActionType, VehicleStatus

MAX_ACTIONS: Final = 4
CRITICAL_SEVERITY_THRESHOLD: Final = 0.85
CRITICAL_COLLAPSE_THRESHOLD: Final = 0.55
COLLAPSE_RISK_CAUSE_THRESHOLD: Final = 0.4
HIGH_PRIORITY_DELTA: Final = 0.2
REALLOCATION_EVENTS: Final = frozenset(
    {
        EventType.COMM_JAM,
        EventType.BATTERY_DROP,
        EventType.COMM_DEGRADED,
        EventType.GPS_DROP,
        EventType.SENSOR_FAIL,
        EventType.VEHICLE_LOST,
        EventType.NO_GO,
        EventType.PRIORITY_SHIFT,
        EventType.DATA_STALE,
        EventType.TARGET_DETECTED,
        EventType.WEATHER_DEGRADED,
        EventType.RESERVE_DEPLETED,
    },
)


@dataclass(frozen=True, slots=True)
class _ResponseContext:
    current: DashboardState
    stressed: DashboardState
    event: EventRequest
    area: str
    current_assignments: dict[str, Assignment]
    desired_assignments: dict[str, Assignment]


@dataclass(frozen=True, slots=True)
class _SupportActionIntent:
    capability: CapabilityName
    active_action: MicroActionType
    reserve_action: MicroActionType
    active_rationale: str
    reserve_rationale: str


def plan_event_response(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard | None:
    if event.event_type not in REALLOCATION_EVENTS:
        return None

    stressed = _stressed_snapshot(snapshot=snapshot, event=event)
    desired = plan_allocation(vehicles=stressed.vehicles, mission=stressed.mission)
    area = _event_area(snapshot=snapshot, event=event)
    context = _ResponseContext(
        current=snapshot,
        stressed=stressed,
        event=event,
        area=area,
        current_assignments={
            assignment.vehicle_id: assignment for assignment in snapshot.assignments
        },
        desired_assignments={
            assignment.vehicle_id: assignment for assignment in desired.assignments
        },
    )
    actions = _dedupe_actions(
        (*_event_specific_actions(context), *_allocation_actions(context)),
    )
    if len(actions) == 0:
        return None

    preview = _preview_actions(stressed=stressed, actions=actions)
    return RecommendationCard(
        id=card_id,
        severity=_severity(event=event, stressed=stressed),
        title=_title(event=event, area=area),
        causes=_causes(event=event, stressed=stressed),
        actions=actions,
        expected_effect=_kpi_delta(before=stressed.metrics, after=preview.metrics, actions=actions),
    )


def _stressed_snapshot(snapshot: DashboardState, event: EventRequest) -> DashboardState:
    updated = snapshot.model_copy(
        update={
            "mission": apply_event_to_mission(snapshot.mission, event),
            "vehicles": tuple(
                apply_event_to_vehicle(vehicle=vehicle, event=event)
                for vehicle in snapshot.vehicles
            ),
        },
    )
    return refresh_snapshot(snapshot=updated)


def _event_specific_actions(  # noqa: C901, PLR0911
    context: _ResponseContext,
) -> tuple[MicroAction, ...]:
    event = context.event
    match event.event_type:
        case EventType.BATTERY_DROP:
            return (
                card_action(
                    event.target,
                    MicroActionType.RETURN,
                    None,
                    "preserve low-battery asset before exhaustion",
                ),
                *_replacement_actions(context),
            )
        case EventType.DATA_STALE:
            return (
                card_action(
                    "system",
                    MicroActionType.MARK_AREA_STALE,
                    context.area,
                    "refresh stale intelligence value",
                ),
            )
        case EventType.TARGET_DETECTED:
            overwatch = _best_vehicle_for_capability(context, CapabilityName.OVERWATCH)
            handoff = (
                ()
                if overwatch is None
                else (
                    card_action(
                        overwatch,
                        MicroActionType.HANDOFF_TARGET,
                        context.area,
                        "handoff contact to the best available overwatch asset",
                    ),
                )
            )
            return (
                card_action(
                    "system",
                    MicroActionType.REQUEST_HUMAN_CONFIRM,
                    context.area,
                    "gate target update before task force reshuffle",
                ),
                *handoff,
            )
        case EventType.WEATHER_DEGRADED:
            target = _best_vehicle_for_capability(context, CapabilityName.VISUAL_RECON)
            if target is None:
                return ()
            return (
                card_action(
                    target,
                    MicroActionType.SWITCH_SENSOR_MODE,
                    context.area,
                    "use robust sensing mode under degraded confidence",
                ),
            )
        case EventType.COMM_DEGRADED | EventType.COMM_JAM:
            target = _best_vehicle_in_area(context=context)
            if target is None:
                return ()
            return (
                card_action(
                    target,
                    MicroActionType.LOW_BANDWIDTH,
                    context.area,
                    "reduce link load while relay posture is replanned",
                ),
            )
        case (
            EventType.GPS_DROP
            | EventType.SENSOR_FAIL
            | EventType.NO_GO
            | EventType.PRIORITY_SHIFT
        ):
            return _route_control_actions(context)
        case EventType.VEHICLE_LOST:
            return _replacement_actions(context)
        case EventType.RESERVE_DEPLETED:
            return (
                card_action(
                    "system",
                    MicroActionType.DOWNGRADE_OBJECTIVE,
                    context.area,
                    "trim low-priority cells if reserve margin cannot absorb the event",
                ),
            )


def _route_control_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    match context.event.event_type:
        case EventType.GPS_DROP:
            return _gps_drop_actions(context)
        case EventType.SENSOR_FAIL:
            return _sensor_fail_actions(context)
        case EventType.NO_GO:
            return _no_go_actions(context)
        case EventType.PRIORITY_SHIFT:
            return _priority_shift_actions(context)
        case _:
            return ()


def _gps_drop_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    target = _vehicle_by_id(context.stressed.vehicles, context.event.target)
    actions: list[MicroAction] = []
    if target is not None and target.status != VehicleStatus.LOST:
        actions.append(
            card_action(
                target.id,
                MicroActionType.HOLD,
                None,
                "hold low-speed mode while GPS-denied support is assigned",
            ),
        )
    support = _support_action_for_capability(
        context=context,
        exclude=frozenset({context.event.target}),
        intent=_SupportActionIntent(
            capability=CapabilityName.GPS_DENIED_NAV,
            active_action=MicroActionType.REROUTE,
            reserve_action=MicroActionType.LAUNCH_RESERVE,
            active_rationale="reroute GPS-denied navigation support toward the affected area",
            reserve_rationale="launch GPS-denied reserve to stabilize navigation coverage",
        ),
    )
    if support is not None:
        actions.append(support)
    return tuple(actions)


def _sensor_fail_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    target = _vehicle_by_id(context.stressed.vehicles, context.event.target)
    actions: list[MicroAction] = []
    if target is not None and target.status != VehicleStatus.LOST:
        actions.append(
            card_action(
                target.id,
                MicroActionType.SWITCH_SENSOR_MODE,
                context.area,
                "switch degraded payload to robust sensing mode",
            ),
        )
    replacement = _replacement_actions(context)
    if len(replacement) > 0:
        actions.extend(replacement)
        return tuple(actions)
    support = _support_action_for_capability(
        context=context,
        exclude=frozenset({context.event.target}),
        intent=_SupportActionIntent(
            capability=CapabilityName.VISUAL_RECON,
            active_action=MicroActionType.REASSIGN_ROLE,
            reserve_action=MicroActionType.REPLACE,
            active_rationale="shift visual recon asset to backfill failed sensor coverage",
            reserve_rationale="replace failed sensor coverage from reserve allocation",
        ),
    )
    if support is not None:
        actions.append(support)
    return tuple(actions)


def _no_go_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    actions = [
        card_action(
            "system",
            MicroActionType.REQUEST_HUMAN_CONFIRM,
            context.area,
            "confirm no-go boundary before route reshuffle",
        ),
    ]
    reroute = _best_vehicle_in_area(context=context)
    if reroute is not None:
        actions.append(
            card_action(
                reroute,
                MicroActionType.REROUTE,
                context.area,
                "reroute active asset through approved corridor around no-go area",
            ),
        )
    return tuple(actions)


def _priority_shift_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    capability = _top_area_gap_capability(context) or CapabilityName.VISUAL_RECON
    support = _support_action_for_capability(
        context=context,
        exclude=frozenset(),
        intent=_SupportActionIntent(
            capability=capability,
            active_action=MicroActionType.REASSIGN_ROLE,
            reserve_action=MicroActionType.LAUNCH_RESERVE,
            active_rationale=f"surge {capability.value} asset into higher-priority area",
            reserve_rationale=f"launch reserve to surge {capability.value} capacity",
        ),
    )
    if support is None:
        return ()
    return (support,)


def _allocation_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    actions: list[MicroAction] = []
    for desired in _ranked_desired_assignments(context):
        if len(actions) >= MAX_ACTIONS:
            break
        vehicle = _vehicle_by_id(context.stressed.vehicles, desired.vehicle_id)
        if (
            vehicle is None
            or vehicle.status == VehicleStatus.LOST
            or not is_battery_viable_replacement(
                vehicle=vehicle,
                snapshot=context.stressed,
                area=desired.area,
            )
        ):
            continue
        current = context.current_assignments.get(desired.vehicle_id)
        if current == desired:
            continue
        actions.append(_action_for_assignment(context=context, vehicle=vehicle, desired=desired))
    return tuple(actions)


def _replacement_actions(context: _ResponseContext) -> tuple[MicroAction, ...]:
    replacement = _replacement_assignment(context)
    if replacement is None:
        return ()
    return (
        card_action(
            replacement.vehicle_id,
            MicroActionType.REPLACE,
            replacement.area,
            "replace degraded or lost coverage from reserve allocation",
        ),
    )


def _replacement_assignment(context: _ResponseContext) -> Assignment | None:
    for assignment in _ranked_desired_assignments(context):
        if assignment.area != context.area or assignment.vehicle_id == context.event.target:
            continue
        vehicle = _vehicle_by_id(context.stressed.vehicles, assignment.vehicle_id)
        if vehicle is None or vehicle.status == VehicleStatus.LOST:
            continue
        if (
            assignment.vehicle_id not in context.current_assignments
            or vehicle.status == VehicleStatus.STANDBY
            or vehicle.area == "GCS"
        ):
            return assignment
    reserve = _best_standby_reserve(context)
    if reserve is None:
        return None
    return Assignment(vehicle_id=reserve.id, area=context.area, role=CapabilityName.RESERVE)


def _best_standby_reserve(context: _ResponseContext) -> Vehicle | None:
    candidates = [
        vehicle
        for vehicle in context.stressed.vehicles
        if vehicle.status == VehicleStatus.STANDBY and vehicle.id != context.event.target
        and is_battery_viable_replacement(
            vehicle=vehicle,
            snapshot=context.stressed,
            area=context.area,
        )
    ]
    if len(candidates) == 0:
        return None
    return max(candidates, key=lambda vehicle: vehicle.capabilities.reserve)


def _support_action_for_capability(
    context: _ResponseContext,
    exclude: frozenset[str],
    intent: _SupportActionIntent,
) -> MicroAction | None:
    vehicle = _best_support_vehicle_for_capability(
        context=context,
        capability=intent.capability,
        exclude=exclude,
    )
    if vehicle is None:
        return None
    if vehicle.status == VehicleStatus.STANDBY or vehicle.area == "GCS":
        return card_action(
            vehicle.id,
            intent.reserve_action,
            context.area,
            intent.reserve_rationale,
        )
    return card_action(vehicle.id, intent.active_action, context.area, intent.active_rationale)


def _best_support_vehicle_for_capability(
    context: _ResponseContext,
    capability: CapabilityName,
    exclude: frozenset[str],
) -> Vehicle | None:
    candidates = [
        vehicle
        for vehicle in context.stressed.vehicles
        if vehicle.id not in exclude
        and vehicle.status != VehicleStatus.LOST
        and not vehicle.synthetic
        and is_battery_viable_replacement(
            vehicle=vehicle,
            snapshot=context.stressed,
            area=context.area,
        )
    ]
    if len(candidates) == 0:
        return None
    return max(
        candidates,
        key=lambda vehicle: (
            1 if vehicle.status == VehicleStatus.STANDBY or vehicle.area == "GCS" else 0,
            0 if vehicle.area == context.area else 1,
            effective_capability(vehicle).value_for(capability),
        ),
    )


def _dedupe_actions(actions: tuple[MicroAction, ...]) -> tuple[MicroAction, ...]:
    selected: list[MicroAction] = []
    used_vehicles: set[str] = set()
    for action in actions:
        if action.vehicle_id in used_vehicles:
            continue
        selected.append(action)
        used_vehicles.add(action.vehicle_id)
        if len(selected) >= MAX_ACTIONS:
            break
    return tuple(selected)


def _ranked_desired_assignments(context: _ResponseContext) -> tuple[Assignment, ...]:
    return tuple(
        sorted(
            context.desired_assignments.values(),
            key=lambda assignment: (
                context.stressed.mission.area_priorities.get(assignment.area, 0.0),
                1 if assignment.area == context.area else 0,
                _capability_weight(assignment.role),
            ),
            reverse=True,
        ),
    )


def _action_for_assignment(
    context: _ResponseContext,
    vehicle: Vehicle,
    desired: Assignment,
) -> MicroAction:
    current = context.current_assignments.get(vehicle.id)
    if current is None or vehicle.status == VehicleStatus.STANDBY or vehicle.area == "GCS":
        action = _reserve_action_for_event(context.event.event_type)
        rationale = "launch reserve from GCS to fill event-driven capability gap"
        return card_action(vehicle.id, action, desired.area, rationale)

    if desired.role == CapabilityName.RELAY:
        return card_action(
            vehicle.id,
            MicroActionType.REPOSITION_RELAY,
            desired.area,
            "move relay coverage toward the highest-value gap",
        )

    if desired.role == CapabilityName.OVERWATCH and desired.area == context.area:
        return card_action(
            vehicle.id,
            MicroActionType.HANDOFF_TARGET,
            desired.area,
            "handoff contact to the asset best suited for overwatch",
        )

    priority_delta = context.stressed.mission.area_priorities.get(
        desired.area, 0.0
    ) - context.stressed.mission.area_priorities.get(current.area, 0.0)
    rationale = (
        "pull asset from lower-priority tasking into higher-priority response"
        if priority_delta >= HIGH_PRIORITY_DELTA
        else "reassign asset to close the highest utility capability gap"
    )
    return card_action(vehicle.id, MicroActionType.REASSIGN_ROLE, desired.area, rationale)


def _reserve_action_for_event(event_type: EventType) -> MicroActionType:
    if event_type in {EventType.BATTERY_DROP, EventType.VEHICLE_LOST, EventType.SENSOR_FAIL}:
        return MicroActionType.REPLACE
    return MicroActionType.LAUNCH_RESERVE


def _preview_actions(stressed: DashboardState, actions: tuple[MicroAction, ...]) -> DashboardState:
    vehicles = stressed.vehicles
    assignments = stressed.assignments
    for action in actions:
        vehicles, assignments = apply_micro_action(
            vehicles=vehicles,
            assignments=assignments,
            action=action,
        )
    return refresh_snapshot(
        snapshot=stressed.model_copy(update={"vehicles": vehicles, "assignments": assignments}),
    )


def _kpi_delta(
    before: MetricSnapshot,
    after: MetricSnapshot,
    actions: tuple[MicroAction, ...],
) -> KpiDelta:
    return KpiDelta(
        mcc_delta=round(after.mcc - before.mcc, 3),
        collapse_probability_delta=round(
            after.collapse_probability - before.collapse_probability,
            3,
        ),
        autonomy_debt_delta=round(after.autonomy_debt - before.autonomy_debt, 1),
        operator_actions_delta=-(max(1, len(actions) * 3)),
    )


def _severity(event: EventRequest, stressed: DashboardState) -> str:
    gap = top_gap(
        analyze_capability_gaps(
            vehicles=stressed.vehicles,
            mission=stressed.mission,
            assignments=stressed.assignments,
        ),
    )
    if event.severity >= CRITICAL_SEVERITY_THRESHOLD:
        return "critical"
    if stressed.metrics.collapse_probability >= CRITICAL_COLLAPSE_THRESHOLD:
        return "critical"
    if gap is not None and gap.deficit_ratio >= CRITICAL_SEVERITY_THRESHOLD:
        return "critical"
    return "high"


def _causes(event: EventRequest, stressed: DashboardState) -> tuple[str, ...]:
    causes = [event.event_type.value, "capability_deficit", "adaptive_reallocation"]
    if event.target in stressed.mission.no_go_areas:
        causes.append("no_go")
    if stressed.metrics.collapse_probability >= COLLAPSE_RISK_CAUSE_THRESHOLD:
        causes.append("collapse_risk")
    return tuple(dict.fromkeys(causes))


def _title(event: EventRequest, area: str) -> str:
    if event.target == area:
        return f"{area} adaptive response"
    return f"{event.target} adaptive response for {area}"


def _event_area(snapshot: DashboardState, event: EventRequest) -> str:
    if event.target in snapshot.mission.areas:
        return event.target
    vehicle = _vehicle_by_id(snapshot.vehicles, event.target)
    if vehicle is not None and vehicle.area in snapshot.mission.areas:
        return vehicle.area
    return snapshot.mission.areas[0]


def _best_vehicle_in_area(context: _ResponseContext) -> str | None:
    candidates = [
        vehicle
        for vehicle in context.stressed.vehicles
        if vehicle.area == context.area
        and vehicle.status != VehicleStatus.LOST
        and not vehicle.synthetic
    ]
    if len(candidates) == 0:
        return None
    return max(candidates, key=lambda vehicle: vehicle.health.confidence).id


def _best_vehicle_for_capability(
    context: _ResponseContext,
    capability: CapabilityName,
) -> str | None:
    candidates = [
        vehicle
        for vehicle in context.stressed.vehicles
        if vehicle.status != VehicleStatus.LOST and not vehicle.synthetic
        and is_battery_viable_replacement(
            vehicle=vehicle,
            snapshot=context.stressed,
            area=context.area,
        )
    ]
    if len(candidates) == 0:
        return None
    return max(
        candidates,
        key=lambda vehicle: (
            1 if vehicle.area == context.area else 0,
            effective_capability(vehicle).value_for(capability),
        ),
    ).id


def _top_area_gap_capability(context: _ResponseContext) -> CapabilityName | None:
    gap = top_gap(
        tuple(
            item
            for item in analyze_capability_gaps(
                vehicles=context.stressed.vehicles,
                mission=context.stressed.mission,
                assignments=context.stressed.assignments,
            )
            if item.area == context.area
        ),
    )
    if gap is None:
        return None
    return gap.capability


def _vehicle_by_id(vehicles: tuple[Vehicle, ...], vehicle_id: str) -> Vehicle | None:
    return next((vehicle for vehicle in vehicles if vehicle.id == vehicle_id), None)


def _capability_weight(capability: CapabilityName) -> int:
    weights = {
        CapabilityName.RELAY: 5,
        CapabilityName.OVERWATCH: 4,
        CapabilityName.VISUAL_RECON: 3,
        CapabilityName.GPS_DENIED_NAV: 2,
        CapabilityName.RESERVE: 1,
    }
    return weights[capability]
