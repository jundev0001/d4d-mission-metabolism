from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final

from d4d_mission.capability import effective_capability
from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.models import (
    AllocationResponse,
    Assignment,
    CapabilityVector,
    Mission,
    Point,
    Vehicle,
)
from d4d_mission.types import (
    CAPABILITY_NAMES,
    DEPLOYABLE_VEHICLE_TYPES,
    CapabilityName,
    VehicleStatus,
    VehicleType,
)

EPSILON: Final = 1e-9
MIN_COVERAGE_GAIN: Final = 0.03
MIN_UTILITY: Final = 0.02
SYNTHETIC_WEIGHT: Final = 0.75
MAX_EXPLANATIONS: Final = 4
MOVEMENT_COST_WEIGHT: Final = 0.18
BATTERY_PENALTY_WEIGHT: Final = 1.65
NO_GO_PENALTY: Final = 1.15
THREAT_PENALTY_WEIGHT: Final = 0.24
CHURN_PENALTY: Final = 0.12
RESERVE_PRESERVATION_WEIGHT: Final = 0.08
SAME_AREA_BONUS: Final = 0.06
ROLE_FIT_BONUS: Final = 0.08
GCS_AREA: Final[str] = "GCS"
GCS_POINT: Final[Point] = Point(x=50, y=80)
AREA_STAGING_POINTS: Final[dict[str, Point]] = {
    "A": Point(x=25, y=30),
    "B": Point(x=63, y=39),
    "C": Point(x=52, y=67),
}

type Remaining = dict[tuple[str, CapabilityName], float]


@dataclass(frozen=True, slots=True)
class _VehicleMobility:
    speed: float
    endurance: float


@dataclass(frozen=True, slots=True)
class _Placement:
    assignment: Assignment
    capability: CapabilityName
    covered: float
    priority: float
    utility: float
    movement_cost: float
    battery_margin: float
    synthetic: bool


@dataclass(frozen=True, slots=True)
class _Candidate:
    vehicle: Vehicle
    area: str
    capability: CapabilityName
    covered: float
    priority: float
    utility: float
    movement_cost: float
    battery_margin: float
    weight: float


def plan_allocation(vehicles: tuple[Vehicle, ...], mission: Mission) -> AllocationResponse:
    """Deploy only the useful task force and keep surplus UxVs at GCS reserve.

    Strongest ready assets are placed first, each into the priority-weighted
    area and role where its health-weighted capability covers the most mission
    demand. Once the target coverage is met, the remaining assets are left
    unassigned so they can rotate in after events or be pulled into higher
    priority areas by the next approved allocation.
    """
    placements = _plan(vehicles=vehicles, mission=mission)
    reserve_count = sum(1 for vehicle in vehicles if vehicle.status != VehicleStatus.LOST) - len(
        placements
    )
    return AllocationResponse(
        assignments=tuple(placement.assignment for placement in placements),
        explanations=_explanations(placements=placements, reserve_count=reserve_count),
    )


def apply_allocation_to_vehicles(
    vehicles: tuple[Vehicle, ...],
    assignments: tuple[Assignment, ...],
    mission: Mission | None = None,
) -> tuple[Vehicle, ...]:
    assignments_by_vehicle = {assignment.vehicle_id: assignment for assignment in assignments}
    area_slots: dict[str, int] = {}
    updated: list[Vehicle] = []
    for vehicle in vehicles:
        if vehicle.status == VehicleStatus.LOST:
            updated.append(vehicle)
            continue
        assignment = assignments_by_vehicle.get(vehicle.id)
        if assignment is None:
            updated.append(
                vehicle.model_copy(
                    update={
                        "area": GCS_AREA,
                        "status": VehicleStatus.STANDBY,
                        "position": _staging_position(
                            area=GCS_AREA,
                            slot=len(updated),
                            mission=mission,
                        ),
                    },
                ),
            )
            continue
        slot = area_slots.get(assignment.area, 0)
        area_slots[assignment.area] = slot + 1
        updated.append(
            vehicle.model_copy(
                update={
                    "area": assignment.area,
                    "role": assignment.role,
                    "status": VehicleStatus.ACTIVE,
                    "position": _staging_position(
                        area=assignment.area,
                        slot=slot,
                        mission=mission,
                    ),
                },
            ),
        )
    return tuple(updated)


def _plan(vehicles: tuple[Vehicle, ...], mission: Mission) -> tuple[_Placement, ...]:
    remaining: Remaining = {
        (area, capability): (
            mission.requirements[area].required_for(capability) * mission.constraints.target_mcc
        )
        for area in mission.areas
        for capability in CAPABILITY_NAMES
        if mission.requirements[area].required_for(capability) > 0
    }
    assignable: list[Vehicle] = [vehicle for vehicle in vehicles if _is_assignable(vehicle)]
    placements: list[_Placement] = []
    while len(assignable) > 0 and any(value > EPSILON for value in remaining.values()):
        candidate = _best_candidate(
            vehicles=tuple(assignable),
            mission=mission,
            remaining=remaining,
        )
        if candidate is None or candidate.utility < MIN_UTILITY:
            break
        placements.append(
            _Placement(
                assignment=Assignment(
                    vehicle_id=candidate.vehicle.id,
                    area=candidate.area,
                    role=candidate.capability,
                    weight=candidate.weight,
                ),
                capability=candidate.capability,
                covered=round(candidate.covered, 3),
                priority=round(candidate.priority, 3),
                utility=round(candidate.utility, 3),
                movement_cost=round(candidate.movement_cost, 3),
                battery_margin=round(candidate.battery_margin, 3),
                synthetic=candidate.vehicle.synthetic,
            ),
        )
        _consume(
            remaining=remaining,
            area=candidate.area,
            effective=effective_capability(candidate.vehicle),
            weight=candidate.weight,
        )
        assignable = [vehicle for vehicle in assignable if vehicle.id != candidate.vehicle.id]
    return tuple(placements)


def _coverage(
    effective: CapabilityVector,
    weight: float,
    remaining: Remaining,
    area: str,
    capability: CapabilityName,
) -> float:
    return min(effective.value_for(capability) * weight, remaining.get((area, capability), 0.0))


def _best_candidate(
    vehicles: tuple[Vehicle, ...],
    mission: Mission,
    remaining: Remaining,
) -> _Candidate | None:
    if all(value <= EPSILON for value in remaining.values()):
        return None
    candidates = [
        candidate
        for vehicle in vehicles
        for candidate in (
            _candidate_for_area(vehicle, area, mission, remaining) for area in mission.areas
        )
        if candidate is not None
    ]
    if len(candidates) == 0:
        return None
    return max(candidates, key=lambda candidate: candidate.utility)


def _candidate_for_area(
    vehicle: Vehicle,
    area: str,
    mission: Mission,
    remaining: Remaining,
) -> _Candidate | None:
    effective = effective_capability(vehicle)
    weight = SYNTHETIC_WEIGHT if vehicle.synthetic else 1.0
    covered = _covered_in_area(effective=effective, weight=weight, remaining=remaining, area=area)
    if covered < MIN_COVERAGE_GAIN:
        return None
    capability = max(
        CAPABILITY_NAMES,
        key=lambda cap: _coverage(effective, weight, remaining, area, cap),
    )
    priority = _area_urgency(mission=mission, area=area)
    movement_cost = _movement_cost(vehicle=vehicle, area=area, mission=mission)
    battery_margin = _battery_margin(vehicle=vehicle, area=area, mission=mission)
    utility = _candidate_utility(
        vehicle=vehicle,
        mission=mission,
        area=area,
        capability=capability,
        covered=covered,
        priority=priority,
        movement_cost=movement_cost,
        battery_margin=battery_margin,
    )
    return _Candidate(
        vehicle=vehicle,
        area=area,
        capability=capability,
        covered=covered,
        priority=priority,
        utility=utility,
        movement_cost=movement_cost,
        battery_margin=battery_margin,
        weight=weight,
    )


def _covered_in_area(
    effective: CapabilityVector,
    weight: float,
    remaining: Remaining,
    area: str,
) -> float:
    return sum(
        _coverage(effective, weight, remaining, area, capability) for capability in CAPABILITY_NAMES
    )


def _candidate_utility(  # noqa: PLR0913
    vehicle: Vehicle,
    mission: Mission,
    area: str,
    capability: CapabilityName,
    covered: float,
    priority: float,
    movement_cost: float,
    battery_margin: float,
) -> float:
    base_gain = covered * priority
    role_bonus = _role_fit_bonus(vehicle=vehicle, capability=capability)
    no_go_penalty = NO_GO_PENALTY if area in mission.no_go_areas else 0.0
    battery_penalty = max(0.0, -battery_margin) * BATTERY_PENALTY_WEIGHT
    threat_penalty = _threat_penalty(vehicle=vehicle, mission=mission, area=area)
    churn_penalty = _churn_penalty(vehicle=vehicle, area=area)
    reserve_penalty = _reserve_preservation_penalty(vehicle=vehicle, capability=capability)
    return (
        base_gain
        + role_bonus
        + _same_area_bonus(vehicle=vehicle, area=area)
        - movement_cost
        - no_go_penalty
        - battery_penalty
        - threat_penalty
        - churn_penalty
        - reserve_penalty
    )


def _consume(
    remaining: Remaining,
    area: str,
    effective: CapabilityVector,
    weight: float,
) -> None:
    for capability in CAPABILITY_NAMES:
        key = (area, capability)
        if key in remaining:
            remaining[key] = max(0.0, remaining[key] - (effective.value_for(capability) * weight))


def _explanation_line(placement: _Placement) -> str:
    assignment = placement.assignment
    delta = f"+{placement.covered:.2f}"
    utility = f"utility {placement.utility:.2f}"
    move = f"move {placement.movement_cost:.2f}"
    battery = f"battery margin {placement.battery_margin:.2f}"
    return (
        f"{assignment.vehicle_id} -> {assignment.area} "
        f"{placement.capability.value} {delta} ({utility}, {move}, {battery})"
    )


def _explanations(placements: tuple[_Placement, ...], reserve_count: int) -> tuple[str, ...]:
    filled = [
        placement for placement in placements if not placement.synthetic and placement.covered > 0
    ]
    ranked = sorted(
        filled,
        key=lambda placement: placement.covered * placement.priority,
        reverse=True,
    )
    explanations = [_explanation_line(placement) for placement in ranked[:MAX_EXPLANATIONS]]
    if reserve_count > 0:
        explanations.append(f"{reserve_count} UxVs remain at GCS reserve for rotation/replacement")
    return tuple(explanations)


def _is_assignable(vehicle: Vehicle) -> bool:
    return vehicle.status not in {VehicleStatus.LOST, VehicleStatus.RETURNING}


def _area_urgency(mission: Mission, area: str) -> float:
    priority = mission.area_priorities.get(area, 0.5)
    threat = mission.area_threats.get(area, 0.0)
    return 1.0 + priority + (threat * 0.25)


def _movement_cost(vehicle: Vehicle, area: str, mission: Mission) -> float:
    mobility = _vehicle_mobility(vehicle.type)
    distance = (
        _distance(
            vehicle.position,
            _staging_position(area=area, slot=0, mission=mission),
        )
        / 100
    )
    return (distance / max(mobility.speed, 0.12)) * MOVEMENT_COST_WEIGHT


def _battery_margin(vehicle: Vehicle, area: str, mission: Mission) -> float:
    mobility = _vehicle_mobility(vehicle.type)
    distance = (
        _distance(
            vehicle.position,
            _staging_position(area=area, slot=0, mission=mission),
        )
        / 100
    )
    reserve_floor = mission.constraints.return_battery_threshold
    travel_budget = distance * (0.32 / max(mobility.endurance, 0.25))
    required = reserve_floor + travel_budget
    return vehicle.health.battery - required


def _threat_penalty(vehicle: Vehicle, mission: Mission, area: str) -> float:
    threat = mission.area_threats.get(area, 0.0)
    comm_exposure = (1.0 - vehicle.health.comm) * threat * 0.42
    nav_exposure = (1.0 - vehicle.health.nav) * threat * 0.22
    health_exposure = (1.0 - vehicle.health.health) * threat * 0.18
    return (threat * THREAT_PENALTY_WEIGHT) + comm_exposure + nav_exposure + health_exposure


def _churn_penalty(vehicle: Vehicle, area: str) -> float:
    if vehicle.status != VehicleStatus.ACTIVE:
        return 0.0
    if vehicle.area in {GCS_AREA, area}:
        return 0.0
    return CHURN_PENALTY


def _same_area_bonus(vehicle: Vehicle, area: str) -> float:
    if vehicle.status == VehicleStatus.ACTIVE and vehicle.area == area:
        return SAME_AREA_BONUS
    return 0.0


def _role_fit_bonus(vehicle: Vehicle, capability: CapabilityName) -> float:
    if vehicle.role == capability:
        return ROLE_FIT_BONUS
    return 0.0


def _reserve_preservation_penalty(vehicle: Vehicle, capability: CapabilityName) -> float:
    if vehicle.status != VehicleStatus.STANDBY or capability == CapabilityName.RESERVE:
        return 0.0
    return vehicle.capabilities.reserve * RESERVE_PRESERVATION_WEIGHT


def _vehicle_mobility(vehicle_type: VehicleType) -> _VehicleMobility:
    if vehicle_type in DEPLOYABLE_VEHICLE_TYPES:
        profile = vehicle_type_profile(vehicle_type)
        return _VehicleMobility(speed=profile.speed, endurance=profile.endurance)
    return _VehicleMobility(speed=0.45, endurance=0.55)


def _distance(origin: Point, target: Point) -> float:
    return math.hypot(origin.x - target.x, origin.y - target.y)


def _staging_position(area: str, slot: int, mission: Mission | None = None) -> Point:
    anchor = _area_anchor(area=area, mission=mission)
    column = slot % 4
    row = slot // 4
    return Point(x=anchor.x - 5.1 + (column * 3.4), y=anchor.y + 3.2 + (row * 3.1))


def _area_anchor(area: str, mission: Mission | None) -> Point:
    if area == GCS_AREA:
        return GCS_POINT
    if mission is not None and area in mission.area_centers:
        return mission.area_centers[area]
    return AREA_STAGING_POINTS.get(area, GCS_POINT)
