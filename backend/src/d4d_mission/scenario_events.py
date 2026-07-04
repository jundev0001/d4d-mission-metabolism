from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import assert_never

from d4d_mission.capability import clamp01
from d4d_mission.models import CapabilityDemand, EventRequest, HealthState, Mission, Vehicle
from d4d_mission.types import EventType, VehicleStatus

type VehicleEventHandler = Callable[[Vehicle, EventRequest], Vehicle]
type MissionUpdateValue = dict[str, CapabilityDemand] | dict[str, float] | tuple[str, ...]


def apply_event_to_vehicle(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    handlers: dict[EventType, VehicleEventHandler] = {
        EventType.COMM_JAM: _apply_comm_jam,
        EventType.BATTERY_DROP: _apply_battery_drop,
        EventType.COMM_DEGRADED: _apply_comm_degraded,
        EventType.GPS_DROP: _apply_gps_drop,
        EventType.SENSOR_FAIL: _apply_sensor_fail,
        EventType.VEHICLE_LOST: _apply_vehicle_lost,
        EventType.MOBILITY_BLOCKED: _apply_mobility_blocked,
        EventType.COLLISION_RISK: _apply_collision_risk,
        EventType.SENSOR_CONFIDENCE_DROP: _apply_sensor_confidence_drop,
        EventType.WEATHER_DEGRADED: _apply_weather_degraded,
    }
    return handlers.get(event.event_type, _unchanged_vehicle)(vehicle, event)


def _apply_comm_jam(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.COMM_JAM and vehicle.area == event.target:
        return with_health(
            vehicle,
            HealthPatch(
                comm=vehicle.health.comm * (1 - (event.severity * 0.55)),
                confidence=vehicle.health.confidence * (1 - (event.severity * 0.18)),
                reason="B-area jammer pressure",
            ),
        )
    return vehicle


def _apply_battery_drop(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.BATTERY_DROP and vehicle.id == event.target:
        return with_health(vehicle, HealthPatch(battery=0.14, reason="battery below return gate"))
    return vehicle


def _apply_comm_degraded(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.COMM_DEGRADED and vehicle.id == event.target:
        return with_health(
            vehicle,
            HealthPatch(comm=vehicle.health.comm * 0.38, reason="packet loss"),
        )
    return vehicle


def _apply_gps_drop(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.GPS_DROP and vehicle.id == event.target:
        return with_health(vehicle, HealthPatch(nav=vehicle.health.nav * 0.32, reason="gps denied"))
    return vehicle


def _apply_sensor_fail(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.SENSOR_FAIL and vehicle.id == event.target:
        return with_health(vehicle, HealthPatch(sensor=0.12, reason="sensor failure"))
    return vehicle


def _apply_vehicle_lost(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.VEHICLE_LOST and vehicle.id == event.target:
        lost = with_health(vehicle, HealthPatch(health=0.0, reason="vehicle lost"))
        return lost.model_copy(update={"status": VehicleStatus.LOST})
    return vehicle


def _apply_mobility_blocked(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.MOBILITY_BLOCKED and vehicle.id == event.target:
        return with_health(
            vehicle,
            HealthPatch(
                nav=vehicle.health.nav * (1 - (event.severity * 0.45)),
                confidence=vehicle.health.confidence * (1 - (event.severity * 0.2)),
                reason="mobility blocked",
            ),
        )
    return vehicle


def _apply_collision_risk(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.COLLISION_RISK and vehicle.id == event.target:
        return with_health(
            vehicle,
            HealthPatch(
                nav=vehicle.health.nav * (1 - (event.severity * 0.18)),
                confidence=vehicle.health.confidence * (1 - (event.severity * 0.16)),
                reason="path deconfliction required",
            ),
        )
    return vehicle


def _apply_sensor_confidence_drop(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.SENSOR_CONFIDENCE_DROP and vehicle.id == event.target:
        return with_health(
            vehicle,
            HealthPatch(
                sensor=vehicle.health.sensor * (1 - (event.severity * 0.35)),
                confidence=vehicle.health.confidence * (1 - (event.severity * 0.4)),
                reason="sensor confidence degraded",
            ),
        )
    return vehicle


def _apply_weather_degraded(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    if event.event_type == EventType.WEATHER_DEGRADED and vehicle.area == event.target:
        return with_health(
            vehicle,
            HealthPatch(
                nav=vehicle.health.nav * (1 - (event.severity * 0.12)),
                sensor=vehicle.health.sensor * (1 - (event.severity * 0.18)),
                confidence=vehicle.health.confidence * (1 - (event.severity * 0.2)),
                reason="weather degraded",
            ),
        )
    return vehicle


def _unchanged_vehicle(vehicle: Vehicle, _event: EventRequest) -> Vehicle:
    return vehicle


def apply_event_to_mission(mission: Mission, event: EventRequest) -> Mission:
    updates: dict[str, MissionUpdateValue] = {}
    match event.event_type:
        case EventType.COMM_JAM | EventType.WEATHER_DEGRADED:
            updates["area_threats"] = _threats_with_event(mission=mission, event=event)
        case EventType.NO_GO:
            updates["area_threats"] = _threats_with_event(mission=mission, event=event)
            updates["no_go_areas"] = tuple(sorted({*mission.no_go_areas, event.target}))
        case EventType.PRIORITY_SHIFT:
            updates["requirements"] = _requirements_with_delta(
                mission=mission,
                target=event.target,
                delta=RequirementDelta(visual_recon=0.28, relay=0.18),
            )
        case EventType.DATA_STALE:
            updates["requirements"] = _requirements_with_delta(
                mission=mission,
                target=event.target,
                delta=RequirementDelta(
                    visual_recon=event.severity * 0.18,
                    overwatch=event.severity * 0.08,
                ),
            )
        case EventType.TARGET_DETECTED:
            updates["requirements"] = _requirements_with_delta(
                mission=mission,
                target=event.target,
                delta=RequirementDelta(
                    visual_recon=event.severity * 0.22,
                    relay=event.severity * 0.1,
                    overwatch=event.severity * 0.24,
                ),
            )
            updates["area_threats"] = _threats_with_event(mission=mission, event=event)
        case EventType.RESERVE_DEPLETED:
            updates["requirements"] = _requirements_with_delta(
                mission=mission,
                target=event.target,
                delta=RequirementDelta(reserve=event.severity * 0.2),
            )
        case (
            EventType.GPS_DROP
            | EventType.BATTERY_DROP
            | EventType.SENSOR_FAIL
            | EventType.VEHICLE_LOST
            | EventType.ALERT_FLOOD
            | EventType.COMM_DEGRADED
            | EventType.MOBILITY_BLOCKED
            | EventType.COLLISION_RISK
            | EventType.SENSOR_CONFIDENCE_DROP
            | EventType.ASSET_ADDED
        ):
            return mission
        case unreachable:
            assert_never(unreachable)
    return mission.model_copy(update=updates)


@dataclass(frozen=True, slots=True)
class RequirementDelta:
    visual_recon: float = 0.0
    relay: float = 0.0
    overwatch: float = 0.0
    reserve: float = 0.0


def _requirements_with_delta(
    mission: Mission,
    target: str,
    delta: RequirementDelta,
) -> dict[str, CapabilityDemand]:
    requirements = dict(mission.requirements)
    current = requirements[target]
    requirements[target] = current.model_copy(
        update={
            "visual_recon": current.visual_recon + delta.visual_recon,
            "relay": current.relay + delta.relay,
            "overwatch": current.overwatch + delta.overwatch,
            "reserve": current.reserve + delta.reserve,
        },
    )
    return requirements


@dataclass(frozen=True, slots=True)
class HealthPatch:
    reason: str
    battery: float | None = None
    comm: float | None = None
    nav: float | None = None
    sensor: float | None = None
    health: float | None = None
    confidence: float | None = None


def with_health(vehicle: Vehicle, patch: HealthPatch) -> Vehicle:
    health = HealthState(
        battery=clamp01(vehicle.health.battery if patch.battery is None else patch.battery),
        comm=clamp01(vehicle.health.comm if patch.comm is None else patch.comm),
        nav=clamp01(vehicle.health.nav if patch.nav is None else patch.nav),
        sensor=clamp01(vehicle.health.sensor if patch.sensor is None else patch.sensor),
        health=clamp01(vehicle.health.health if patch.health is None else patch.health),
        confidence=clamp01(
            vehicle.health.confidence if patch.confidence is None else patch.confidence,
        ),
        degradation_reason=patch.reason,
    )
    return vehicle.model_copy(update={"health": health})


def event_summary(event: EventRequest) -> str:
    summaries = {
        EventType.COMM_JAM: f"{event.target} area jammer is degrading relay capability",
        EventType.BATTERY_DROP: f"{event.target} battery dropped below return threshold",
        EventType.COMM_DEGRADED: f"{event.target} link quality degraded",
        EventType.GPS_DROP: f"{event.target} entered GPS-denied navigation",
        EventType.SENSOR_FAIL: f"{event.target} sensor payload failed",
        EventType.VEHICLE_LOST: f"{event.target} is no longer contributing capability",
        EventType.ALERT_FLOOD: "Low-priority alerts are saturating operator attention",
        EventType.NO_GO: f"{event.target} became a no-go area",
        EventType.PRIORITY_SHIFT: f"{event.target} mission priority increased",
        EventType.DATA_STALE: f"{event.target} area intelligence is stale",
        EventType.TARGET_DETECTED: f"{event.target} area target confidence increased",
        EventType.MOBILITY_BLOCKED: f"{event.target} mobility is blocked by terrain",
        EventType.WEATHER_DEGRADED: f"{event.target} area weather degraded sensing and nav",
        EventType.COLLISION_RISK: f"{event.target} has path collision risk",
        EventType.SENSOR_CONFIDENCE_DROP: f"{event.target} sensor confidence dropped",
        EventType.ASSET_ADDED: f"{event.target} area has a new asset available",
        EventType.RESERVE_DEPLETED: f"{event.target} reserve budget is depleted",
    }
    return summaries[event.event_type]


def _threats_with_event(mission: Mission, event: EventRequest) -> dict[str, float]:
    threats = dict(mission.area_threats)
    threats[event.target] = clamp01(max(threats.get(event.target, 0.0), event.severity))
    return threats
