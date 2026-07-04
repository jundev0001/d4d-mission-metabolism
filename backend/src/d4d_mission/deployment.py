from __future__ import annotations

from dataclasses import dataclass
from typing import Final, override

from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.models import DashboardState, HealthState, Point, Vehicle
from d4d_mission.scenario import refresh_snapshot
from d4d_mission.types import AreaId, VehicleStatus, VehicleType

MIN_DEPLOYED_ASSETS: Final = 5
MAX_DEPLOYED_ASSETS: Final = 24
GCS_AREA: Final[AreaId] = "GCS"
GCS_POINT: Final[Point] = Point(x=50, y=80)


@dataclass(frozen=True, slots=True)
class DeploymentCount:
    vehicle_type: VehicleType
    count: int


@dataclass(frozen=True, slots=True)
class DeploymentError(Exception):
    reason: str

    @override
    def __str__(self) -> str:
        return self.reason


def apply_fleet_deployment(
    snapshot: DashboardState,
    deployment: tuple[DeploymentCount, ...],
) -> DashboardState:
    vehicles = _build_vehicles(deployment)
    updated = snapshot.model_copy(
        update={
            "vehicles": vehicles,
            "assignments": (),
            "recommendations": (),
            "events": (),
            "scenario_time": 0,
            "assisted_operator_actions": 1,
            "system_micro_actions": 1,
            "human_intents": 1,
            "recovery_actions": 0,
        },
    )
    return refresh_snapshot(snapshot=updated)


def _build_vehicles(deployment: tuple[DeploymentCount, ...]) -> tuple[Vehicle, ...]:
    total_count = sum(item.count for item in deployment)
    if total_count < MIN_DEPLOYED_ASSETS:
        raise DeploymentError(reason=f"deploy at least {MIN_DEPLOYED_ASSETS} UxVs")
    if total_count > MAX_DEPLOYED_ASSETS:
        raise DeploymentError(reason=f"deploy at most {MAX_DEPLOYED_ASSETS} UxVs")

    vehicles: list[Vehicle] = []
    for item in deployment:
        for _ in range(item.count):
            vehicle_index = len(vehicles) + 1
            vehicles.append(
                _build_vehicle(vehicle_type=item.vehicle_type, vehicle_index=vehicle_index)
            )
    return tuple(vehicles)


def _build_vehicle(vehicle_type: VehicleType, vehicle_index: int) -> Vehicle:
    profile = vehicle_type_profile(vehicle_type)
    return Vehicle(
        id=f"UxV-{vehicle_index:02d}",
        type=vehicle_type,
        label=profile.label,
        area=GCS_AREA,
        role=profile.primary_role,
        position=_gcs_position(vehicle_index - 1),
        velocity=Point(x=0, y=0),
        health=_health_for(profile_endurance=profile.endurance, profile_speed=profile.speed),
        capabilities=profile.capabilities,
        status=VehicleStatus.STANDBY,
    )


def _gcs_position(slot: int) -> Point:
    column = slot % 6
    row = slot // 6
    return Point(x=GCS_POINT.x - 13 + (column * 5.2), y=GCS_POINT.y - (row * 4.2))


def _health_for(profile_endurance: float, profile_speed: float) -> HealthState:
    return HealthState(
        battery=min(0.96, 0.62 + profile_endurance * 0.34),
        comm=min(0.96, 0.78 + profile_speed * 0.18),
        nav=min(0.94, 0.72 + profile_speed * 0.2),
        sensor=0.88,
        health=0.94,
    )
