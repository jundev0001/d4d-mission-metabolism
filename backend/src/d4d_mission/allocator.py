from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from d4d_mission.allocation_application import apply_allocation_to_vehicles
from d4d_mission.allocation_explanations import allocation_explanations
from d4d_mission.allocation_movement import (
    battery_margin,
    movement_cost,
)
from d4d_mission.allocation_scoring import (
    CandidateUtilityInput,
    area_urgency,
    candidate_utility,
    capability_fit_score,
)
from d4d_mission.decay import HORIZON_STEPS, horizon_capability
from d4d_mission.models import (
    AllocationResponse,
    Assignment,
    CapabilityVector,
    Mission,
    Vehicle,
)
from d4d_mission.types import (
    CAPABILITY_NAMES,
    CapabilityName,
    VehicleStatus,
)

__all__ = ("apply_allocation_to_vehicles", "plan_allocation")

EPSILON: Final = 1e-9
MIN_COVERAGE_GAIN: Final = 0.03
MIN_UTILITY: Final = 0.02
SYNTHETIC_WEIGHT: Final = 0.75

type Remaining = dict[tuple[str, CapabilityName], float]


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


def plan_allocation(
    vehicles: tuple[Vehicle, ...],
    mission: Mission,
    horizon: int = HORIZON_STEPS,
) -> AllocationResponse:
    """Deploy only the useful task force and keep surplus UxVs at GCS reserve.

    Strongest ready assets are placed first, each into the priority-weighted
    area and role where its health-weighted capability covers the most mission
    demand over the prediction horizon. Once the target coverage is met, the
    remaining assets are left unassigned so they can rotate in after events or
    be pulled into higher priority areas by the next approved allocation.
    """
    placements = _plan(vehicles=vehicles, mission=mission, horizon=horizon)
    reserve_count = sum(1 for vehicle in vehicles if vehicle.status != VehicleStatus.LOST) - len(
        placements
    )
    return AllocationResponse(
        assignments=tuple(placement.assignment for placement in placements),
        explanations=allocation_explanations(placements=placements, reserve_count=reserve_count),
    )


def _plan(
    vehicles: tuple[Vehicle, ...],
    mission: Mission,
    horizon: int,
) -> tuple[_Placement, ...]:
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
            horizon=horizon,
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
            effective=horizon_capability(candidate.vehicle, mission, candidate.area, horizon),
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
    horizon: int,
) -> _Candidate | None:
    if all(value <= EPSILON for value in remaining.values()):
        return None
    candidates = [
        candidate
        for vehicle in vehicles
        for candidate in (
            _candidate_for_area(vehicle, area, mission, remaining, horizon)
            for area in mission.areas
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
    horizon: int,
) -> _Candidate | None:
    effective = horizon_capability(vehicle, mission, area, horizon)
    weight = SYNTHETIC_WEIGHT if vehicle.synthetic else 1.0
    covered = _covered_in_area(effective=effective, weight=weight, remaining=remaining, area=area)
    if covered < MIN_COVERAGE_GAIN:
        return None
    capability = _best_capability_for_area(
        vehicle=vehicle,
        effective=effective,
        weight=weight,
        remaining=remaining,
        area=area,
    )
    capability_covered = _coverage(effective, weight, remaining, area, capability)
    priority = area_urgency(mission=mission, area=area)
    candidate_movement_cost = movement_cost(vehicle=vehicle, area=area, mission=mission)
    candidate_battery_margin = battery_margin(vehicle=vehicle, area=area, mission=mission)
    utility = candidate_utility(
        CandidateUtilityInput(
            vehicle=vehicle,
            mission=mission,
            area=area,
            capability=capability,
            total_covered=covered,
            capability_covered=capability_covered,
            priority=priority,
            movement_cost=candidate_movement_cost,
            battery_margin=candidate_battery_margin,
        ),
    )
    return _Candidate(
        vehicle=vehicle,
        area=area,
        capability=capability,
        covered=covered,
        priority=priority,
        utility=utility,
        movement_cost=candidate_movement_cost,
        battery_margin=candidate_battery_margin,
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


def _best_capability_for_area(
    vehicle: Vehicle,
    effective: CapabilityVector,
    weight: float,
    remaining: Remaining,
    area: str,
) -> CapabilityName:
    return max(
        CAPABILITY_NAMES,
        key=lambda cap: (
            _coverage(effective, weight, remaining, area, cap),
            capability_fit_score(vehicle=vehicle, capability=cap),
        ),
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


def _is_assignable(vehicle: Vehicle) -> bool:
    return vehicle.status not in {VehicleStatus.LOST, VehicleStatus.RETURNING}
