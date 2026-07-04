from __future__ import annotations

from dataclasses import dataclass
from typing import Final, override

from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.models import Assignment, DashboardState, HealthState, Point, Vehicle
from d4d_mission.scenario import refresh_snapshot
from d4d_mission.types import AreaId, VehicleStatus, VehicleType

MIN_DEPLOYED_ASSETS: Final = 5
MAX_DEPLOYED_ASSETS: Final = 24
RESERVE_STANDBY_THRESHOLD: Final = 0.7
DEPLOYMENT_AREAS: Final[tuple[AreaId, ...]] = ("A", "B", "C")
AREA_ANCHORS: Final[dict[AreaId, Point]] = {
    "A": Point(x=20, y=30),
    "B": Point(x=53, y=42),
    "C": Point(x=76, y=64),
}


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
    assignments = tuple(
        Assignment(vehicle_id=vehicle.id, area=vehicle.area, role=vehicle.role)
        for vehicle in vehicles
    )
    updated = snapshot.model_copy(
        update={
            "vehicles": vehicles,
            "assignments": assignments,
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
    area = DEPLOYMENT_AREAS[(vehicle_index - 1) % len(DEPLOYMENT_AREAS)]
    status = (
        VehicleStatus.STANDBY
        if profile.capabilities.reserve >= RESERVE_STANDBY_THRESHOLD
        else VehicleStatus.ACTIVE
    )
    return Vehicle(
        id=f"UxV-{vehicle_index:02d}",
        type=vehicle_type,
        label=profile.label,
        area=area,
        role=profile.primary_role,
        position=_position_for(area=area, vehicle_index=vehicle_index),
        velocity=Point(x=0, y=0),
        health=_health_for(profile_endurance=profile.endurance, profile_speed=profile.speed),
        capabilities=profile.capabilities,
        status=status,
    )


def _position_for(area: AreaId, vehicle_index: int) -> Point:
    anchor = AREA_ANCHORS[area]
    slot = (vehicle_index - 1) // len(DEPLOYMENT_AREAS)
    lateral = ((slot % 4) - 1.5) * 3.8
    vertical = ((slot // 4) % 3) * 4.2
    return Point(x=anchor.x + lateral, y=anchor.y + vertical)


def _health_for(profile_endurance: float, profile_speed: float) -> HealthState:
    return HealthState(
        battery=min(0.96, 0.62 + profile_endurance * 0.34),
        comm=min(0.96, 0.78 + profile_speed * 0.18),
        nav=min(0.94, 0.72 + profile_speed * 0.2),
        sensor=0.88,
        health=0.94,
    )
