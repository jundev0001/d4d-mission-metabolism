from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from d4d_mission.capability import effective_capability
from d4d_mission.models import (
    AllocationResponse,
    Assignment,
    CapabilityVector,
    Mission,
    Vehicle,
)
from d4d_mission.types import CAPABILITY_NAMES, CapabilityName, VehicleStatus

EPSILON: Final = 1e-9
SYNTHETIC_WEIGHT: Final = 0.75
MAX_EXPLANATIONS: Final = 4

type Remaining = dict[tuple[str, CapabilityName], float]


@dataclass(frozen=True, slots=True)
class _Placement:
    assignment: Assignment
    capability: CapabilityName
    covered: float
    synthetic: bool


def plan_allocation(vehicles: tuple[Vehicle, ...], mission: Mission) -> AllocationResponse:
    """Assign the fleet to areas so the largest capability deficits are filled first.

    Strongest assets are placed first, each into the area and role where its
    health-weighted capability covers the most remaining demand. Explanations
    report which demand each placement actually filled so the allocation is
    auditable rather than hardcoded.
    """
    placements = _plan(vehicles=vehicles, mission=mission)
    return AllocationResponse(
        assignments=tuple(placement.assignment for placement in placements),
        explanations=_explanations(placements),
    )


def _plan(vehicles: tuple[Vehicle, ...], mission: Mission) -> tuple[_Placement, ...]:
    remaining: Remaining = {
        (area, capability): mission.requirements[area].required_for(capability)
        for area in mission.areas
        for capability in CAPABILITY_NAMES
        if mission.requirements[area].required_for(capability) > 0
    }
    assignable = sorted(
        (vehicle for vehicle in vehicles if vehicle.status != VehicleStatus.LOST),
        key=_total_capability,
        reverse=True,
    )
    placements: list[_Placement] = []
    for vehicle in assignable:
        effective = effective_capability(vehicle)
        weight = SYNTHETIC_WEIGHT if vehicle.synthetic else 1.0
        area, capability, covered = _choose_placement(
            effective=effective,
            weight=weight,
            mission=mission,
            remaining=remaining,
        )
        placements.append(
            _Placement(
                assignment=Assignment(
                    vehicle_id=vehicle.id,
                    area=area,
                    role=capability,
                    weight=weight,
                ),
                capability=capability,
                covered=round(covered, 3),
                synthetic=vehicle.synthetic,
            ),
        )
        _consume(remaining=remaining, area=area, effective=effective, weight=weight)
    return tuple(placements)


def _coverage(
    effective: CapabilityVector,
    weight: float,
    remaining: Remaining,
    area: str,
    capability: CapabilityName,
) -> float:
    return min(effective.value_for(capability) * weight, remaining.get((area, capability), 0.0))


def _choose_placement(
    effective: CapabilityVector,
    weight: float,
    mission: Mission,
    remaining: Remaining,
) -> tuple[str, CapabilityName, float]:
    dominant = max(CAPABILITY_NAMES, key=effective.value_for)

    def covered_in(area: str) -> float:
        return sum(
            _coverage(effective, weight, remaining, area, capability)
            for capability in CAPABILITY_NAMES
        )

    best_area = max(mission.areas, key=covered_in)
    if covered_in(best_area) <= EPSILON:
        surplus_area = max(
            mission.areas,
            key=lambda area: mission.requirements[area].required_for(dominant),
        )
        return surplus_area, dominant, 0.0

    capability = max(
        CAPABILITY_NAMES,
        key=lambda cap: _coverage(effective, weight, remaining, best_area, cap),
    )
    return best_area, capability, _coverage(effective, weight, remaining, best_area, capability)


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


def _total_capability(vehicle: Vehicle) -> float:
    effective = effective_capability(vehicle)
    return sum(effective.value_for(capability) for capability in CAPABILITY_NAMES)


def _explanation_line(placement: _Placement) -> str:
    assignment = placement.assignment
    delta = f"+{placement.covered:.2f}"
    return f"{assignment.vehicle_id} -> {assignment.area} {placement.capability.value} {delta}"


def _explanations(placements: tuple[_Placement, ...]) -> tuple[str, ...]:
    filled = [
        placement
        for placement in placements
        if not placement.synthetic and placement.covered > 0
    ]
    ranked = sorted(filled, key=lambda placement: placement.covered, reverse=True)
    return tuple(_explanation_line(placement) for placement in ranked[:MAX_EXPLANATIONS])
