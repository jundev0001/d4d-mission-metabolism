from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final

from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.models import Mission, Point, Vehicle
from d4d_mission.types import DEPLOYABLE_VEHICLE_TYPES, VehicleType

MOVEMENT_COST_WEIGHT: Final = 0.18
GCS_AREA: Final[str] = "GCS"
GCS_POINT: Final[Point] = Point(x=94.7, y=58)
GCS_PLANNING_POINT: Final[Point] = Point(x=50, y=80)
AREA_STAGING_POINTS: Final[dict[str, Point]] = {
    "A": Point(x=25, y=30),
    "B": Point(x=63, y=39),
    "C": Point(x=52, y=67),
}


@dataclass(frozen=True, slots=True)
class VehicleMobility:
    speed: float
    endurance: float


def movement_cost(vehicle: Vehicle, area: str, mission: Mission) -> float:
    mobility = _vehicle_mobility(vehicle.type)
    distance = _travel_distance(vehicle=vehicle, area=area, mission=mission) / 100
    return (distance / max(mobility.speed, 0.12)) * MOVEMENT_COST_WEIGHT


def battery_margin(vehicle: Vehicle, area: str, mission: Mission) -> float:
    mobility = _vehicle_mobility(vehicle.type)
    distance = _travel_distance(vehicle=vehicle, area=area, mission=mission) / 100
    reserve_floor = mission.constraints.return_battery_threshold
    travel_budget = distance * (0.32 / max(mobility.endurance, 0.25))
    required = reserve_floor + travel_budget
    return vehicle.health.battery - required


def staging_position(area: str, slot: int, mission: Mission | None = None) -> Point:
    if area == GCS_AREA:
        return _gcs_position(slot)
    anchor = _area_anchor(area=area, mission=mission)
    column = slot % 4
    row = slot // 4
    return Point(x=anchor.x - 5.1 + (column * 3.4), y=anchor.y + 3.2 + (row * 3.1))


def _travel_distance(vehicle: Vehicle, area: str, mission: Mission) -> float:
    return _distance(
        _movement_origin(vehicle),
        staging_position(area=area, slot=0, mission=mission),
    )


def _vehicle_mobility(vehicle_type: VehicleType) -> VehicleMobility:
    if vehicle_type in DEPLOYABLE_VEHICLE_TYPES:
        profile = vehicle_type_profile(vehicle_type)
        return VehicleMobility(speed=profile.speed, endurance=profile.endurance)
    return VehicleMobility(speed=0.45, endurance=0.55)


def _movement_origin(vehicle: Vehicle) -> Point:
    if vehicle.area == GCS_AREA:
        return _gcs_planning_position(vehicle)
    return vehicle.position


def _gcs_planning_position(vehicle: Vehicle) -> Point:
    slot = _gcs_planning_slot(vehicle.id)
    if slot is None:
        return GCS_PLANNING_POINT
    column = slot % 6
    row = slot // 6
    return Point(
        x=GCS_PLANNING_POINT.x - 13 + (column * 5.2),
        y=GCS_PLANNING_POINT.y - (row * 4.2),
    )


def _gcs_planning_slot(vehicle_id: str) -> int | None:
    if vehicle_id.startswith("UxV-"):
        raw_index = vehicle_id.removeprefix("UxV-")
        if raw_index.isdecimal():
            return int(raw_index) - 1
    if vehicle_id.startswith("SW-"):
        raw_index = vehicle_id.removeprefix("SW-")
        if raw_index.isdecimal():
            return int(raw_index) + 5
    return None


def _distance(origin: Point, target: Point) -> float:
    return math.hypot(origin.x - target.x, origin.y - target.y)


def _gcs_position(slot: int) -> Point:
    column = slot % 3
    row = slot // 3
    return Point(x=GCS_POINT.x - 3.9 + (column * 3.9), y=GCS_POINT.y + 3.2 + (row * 3.1))


def _area_anchor(area: str, mission: Mission | None) -> Point:
    if area == GCS_AREA:
        return GCS_POINT
    if mission is not None and area in mission.area_centers:
        return mission.area_centers[area]
    return AREA_STAGING_POINTS.get(area, GCS_POINT)
