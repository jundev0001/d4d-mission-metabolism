from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from d4d_mission.capability import clamp01
from d4d_mission.models import EventRequest, HealthState, Mission, Vehicle
from d4d_mission.types import EventType, VehicleStatus

type VehicleEventHandler = Callable[[Vehicle, EventRequest], Vehicle]


def apply_event_to_vehicle(vehicle: Vehicle, event: EventRequest) -> Vehicle:
    handlers: dict[EventType, VehicleEventHandler] = {
        EventType.COMM_JAM: _apply_comm_jam,
        EventType.BATTERY_DROP: _apply_battery_drop,
        EventType.COMM_DEGRADED: _apply_comm_degraded,
        EventType.GPS_DROP: _apply_gps_drop,
        EventType.SENSOR_FAIL: _apply_sensor_fail,
        EventType.VEHICLE_LOST: _apply_vehicle_lost,
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


def _unchanged_vehicle(vehicle: Vehicle, _event: EventRequest) -> Vehicle:
    return vehicle


def apply_event_to_mission(mission: Mission, event: EventRequest) -> Mission:
    if event.event_type == EventType.COMM_JAM:
        threats = _threats_with_event(mission=mission, event=event)
        return mission.model_copy(update={"area_threats": threats})
    if event.event_type == EventType.NO_GO:
        no_go = tuple(sorted({*mission.no_go_areas, event.target}))
        threats = _threats_with_event(mission=mission, event=event)
        return mission.model_copy(update={"area_threats": threats, "no_go_areas": no_go})
    if event.event_type == EventType.PRIORITY_SHIFT:
        requirements = dict(mission.requirements)
        current = requirements[event.target]
        requirements[event.target] = current.model_copy(
            update={"visual_recon": current.visual_recon + 0.28, "relay": current.relay + 0.18},
        )
        return mission.model_copy(update={"requirements": requirements})
    return mission


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
    }
    return summaries[event.event_type]


def _threats_with_event(mission: Mission, event: EventRequest) -> dict[str, float]:
    threats = dict(mission.area_threats)
    threats[event.target] = clamp01(max(threats.get(event.target, 0.0), event.severity))
    return threats
