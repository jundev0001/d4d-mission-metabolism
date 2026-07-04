from __future__ import annotations

from typing import Final

from d4d_mission.capability import EPSILON, clamp01, effective_capability
from d4d_mission.models import (
    Assignment,
    CapabilityGap,
    CapabilityVector,
    Mission,
    Vehicle,
)
from d4d_mission.types import CAPABILITY_NAMES, CapabilityName, VehicleStatus

MIN_DEFICIT_RATIO: Final = 0.05
CONTRIBUTION_EPSILON: Final = 0.02
MIN_REDUNDANT_CONTRIBUTORS: Final = 2
EW_URGENCY: Final = 0.5
SINGLE_POINT_URGENCY: Final = 0.5


def analyze_capability_gaps(
    vehicles: tuple[Vehicle, ...],
    mission: Mission,
    assignments: tuple[Assignment, ...],
) -> tuple[CapabilityGap, ...]:
    """Return the explicit per-area capability deficits, ranked by priority.

    Supply mirrors the coverage math in ``compute_capability_report`` so the
    reported deficit ratio stays consistent with the dashboard. Priority scales
    the absolute deficit by contested pressure and single-point fragility so the
    immune system and allocator can target the most damaging gap first.
    """
    effective = {vehicle.id: effective_capability(vehicle) for vehicle in vehicles}
    vehicles_by_id = {vehicle.id: vehicle for vehicle in vehicles}
    gaps: list[CapabilityGap] = []
    for area in mission.areas:
        requirement = mission.requirements[area]
        ew_pressure = mission.area_threats.get(area, 0.0)
        for capability in CAPABILITY_NAMES:
            demand = requirement.required_for(capability)
            if demand <= 0:
                continue
            contributions = _contributions(
                area=area,
                capability=capability,
                assignments=assignments,
                effective=effective,
                vehicles_by_id=vehicles_by_id,
            )
            supply = sum(contributions)
            deficit_ratio = clamp01((demand - supply) / (demand + EPSILON))
            if deficit_ratio < MIN_DEFICIT_RATIO:
                continue
            deficit_absolute = max(0.0, demand - supply)
            contributor_count = sum(1 for value in contributions if value > CONTRIBUTION_EPSILON)
            single_point = contributor_count < MIN_REDUNDANT_CONTRIBUTORS
            priority = (
                deficit_absolute
                * (1.0 + (EW_URGENCY * ew_pressure))
                * (1.0 + (SINGLE_POINT_URGENCY if single_point else 0.0))
            )
            gaps.append(
                CapabilityGap(
                    area=area,
                    capability=capability,
                    demand=round(demand, 3),
                    supply=round(supply, 3),
                    deficit_ratio=round(deficit_ratio, 3),
                    deficit_absolute=round(deficit_absolute, 3),
                    contributor_count=contributor_count,
                    single_point=single_point,
                    priority=round(priority, 3),
                ),
            )
    return tuple(sorted(gaps, key=lambda gap: gap.priority, reverse=True))


def top_gap(gaps: tuple[CapabilityGap, ...]) -> CapabilityGap | None:
    return gaps[0] if len(gaps) > 0 else None


def _contributions(
    area: str,
    capability: CapabilityName,
    assignments: tuple[Assignment, ...],
    effective: dict[str, CapabilityVector],
    vehicles_by_id: dict[str, Vehicle],
) -> tuple[float, ...]:
    contributions: list[float] = []
    for assignment in assignments:
        if assignment.area != area:
            continue
        vehicle = vehicles_by_id.get(assignment.vehicle_id)
        if vehicle is None or vehicle.status != VehicleStatus.ACTIVE:
            continue
        vector = effective.get(assignment.vehicle_id)
        if vector is None:
            continue
        contribution = vector.value_for(capability) * assignment.weight
        if contribution > 0:
            contributions.append(contribution)
    return tuple(contributions)
