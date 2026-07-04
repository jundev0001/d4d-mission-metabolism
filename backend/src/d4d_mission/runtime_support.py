from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final, override

from d4d_mission.capability import clamp01
from d4d_mission.decay import project_vehicle
from d4d_mission.scenario import calculation_trace, refresh_snapshot
from d4d_mission.types import EventType, VehicleStatus

if TYPE_CHECKING:
    from d4d_mission.blackbox import JsonlBlackBox
    from d4d_mission.models import Assignment, DashboardState, HealthState, Vehicle
    from d4d_mission.types import VehicleId

AREA_TARGET_EVENTS = frozenset(
    {
        EventType.COMM_JAM,
        EventType.NO_GO,
        EventType.PRIORITY_SHIFT,
        EventType.DATA_STALE,
        EventType.TARGET_DETECTED,
        EventType.WEATHER_DEGRADED,
        EventType.RESERVE_DEPLETED,
    },
)
VEHICLE_TARGET_EVENTS = frozenset(
    {
        EventType.BATTERY_DROP,
        EventType.COMM_DEGRADED,
        EventType.GPS_DROP,
        EventType.SENSOR_FAIL,
        EventType.VEHICLE_LOST,
    },
)
GCS_AREA: Final = "GCS"
GCS_CHARGE_STEP_GAIN: Final = 0.08


@dataclass(frozen=True, slots=True)
class UnknownTargetError(Exception):
    target: str

    @override
    def __str__(self) -> str:
        return f"unknown target {self.target}"


def record_calculation(blackbox: JsonlBlackBox, snapshot: DashboardState, trigger: str) -> None:
    blackbox.record_model(
        scenario_time=snapshot.scenario_time,
        kind="calculation",
        summary=f"{trigger.replace('_', ' ')} recalculated mission metrics",
        model=calculation_trace(snapshot=snapshot, trigger=trigger),
    )


def tune_vehicle_snapshot(
    snapshot: DashboardState,
    vehicle_id: VehicleId,
    health: HealthState,
    status: VehicleStatus,
) -> DashboardState:
    vehicles = _tuned_vehicles(
        vehicles=snapshot.vehicles,
        vehicle_id=vehicle_id,
        health=health,
        status=status,
    )
    if snapshot.baseline_vehicles:
        baseline_vehicles = _tuned_vehicles(
            vehicles=snapshot.baseline_vehicles,
            vehicle_id=vehicle_id,
            health=health,
            status=status,
        )
        return refresh_snapshot(
            snapshot=snapshot.model_copy(
                update={"vehicles": vehicles, "baseline_vehicles": baseline_vehicles},
            ),
        )
    return refresh_snapshot(snapshot=snapshot.model_copy(update={"vehicles": vehicles}))


def refresh_allocation_snapshot(
    snapshot: DashboardState,
    vehicles: tuple[Vehicle, ...],
    assignments: tuple[Assignment, ...],
) -> DashboardState:
    if len(snapshot.events) == 0:
        return refresh_snapshot(
            snapshot=snapshot.model_copy(
                update={
                    "vehicles": vehicles,
                    "assignments": assignments,
                    "baseline_mission": snapshot.mission,
                    "baseline_vehicles": vehicles,
                    "baseline_assignments": assignments,
                },
            ),
        )
    return refresh_snapshot(
        snapshot=snapshot.model_copy(update={"vehicles": vehicles, "assignments": assignments}),
    )


def advance_time_snapshot(snapshot: DashboardState, steps: int) -> DashboardState:
    assignment_areas = {
        assignment.vehicle_id: assignment.area for assignment in snapshot.assignments
    }
    vehicles = tuple(
        _advance_vehicle(
            vehicle=vehicle,
            snapshot=snapshot,
            area=assignment_areas.get(vehicle.id),
            steps=steps,
        )
        for vehicle in snapshot.vehicles
    )
    return refresh_snapshot(
        snapshot=snapshot.model_copy(
            update={
                "vehicles": vehicles,
                "scenario_time": snapshot.scenario_time + (steps * 30),
            },
        ),
    )


def _tuned_vehicles(
    vehicles: tuple[Vehicle, ...],
    vehicle_id: VehicleId,
    health: HealthState,
    status: VehicleStatus,
) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(update={"health": health, "status": status})
        if vehicle.id == vehicle_id
        else vehicle
        for vehicle in vehicles
    )


def _advance_vehicle(
    vehicle: Vehicle,
    snapshot: DashboardState,
    area: str | None,
    steps: int,
) -> Vehicle:
    if vehicle.status == VehicleStatus.STANDBY and vehicle.area == GCS_AREA:
        return _charge_vehicle(vehicle=vehicle, steps=steps)
    if vehicle.status not in {VehicleStatus.ACTIVE, VehicleStatus.RETURNING}:
        return vehicle
    operating_area = area or vehicle.area
    if operating_area not in snapshot.mission.areas:
        return vehicle
    return project_vehicle(
        vehicle=vehicle,
        mission=snapshot.mission,
        area=operating_area,
        steps=steps,
    )


def _charge_vehicle(vehicle: Vehicle, steps: int) -> Vehicle:
    return vehicle.model_copy(
        update={
            "health": vehicle.health.model_copy(
                update={
                    "battery": clamp01(
                        vehicle.health.battery + (steps * GCS_CHARGE_STEP_GAIN),
                    ),
                },
            ),
        },
    )
