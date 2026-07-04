from __future__ import annotations

import math
from typing import Final

from d4d_mission.models import (
    AreaCoverage,
    Assignment,
    CapabilityReport,
    CapabilityVector,
    HealthState,
    Mission,
    Vehicle,
)
from d4d_mission.types import CAPABILITY_NAMES, CapabilityName, VehicleStatus

EPSILON: Final = 0.0001
HEALTH_WEIGHTS: Final = {
    "battery": 0.25,
    "comm": 0.25,
    "nav": 0.2,
    "sensor": 0.2,
    "health": 0.1,
}


def clamp01(value: float) -> float:
    return min(1.0, max(0.0, value))


def availability_score(health: HealthState) -> float:
    factors = (
        health.battery ** HEALTH_WEIGHTS["battery"],
        health.comm ** HEALTH_WEIGHTS["comm"],
        health.nav ** HEALTH_WEIGHTS["nav"],
        health.sensor ** HEALTH_WEIGHTS["sensor"],
        health.health ** HEALTH_WEIGHTS["health"],
    )
    return clamp01(math.prod(factors) * health.confidence)


def effective_capability(vehicle: Vehicle) -> CapabilityVector:
    availability = availability_score(vehicle.health)
    status_factor = 0.0 if vehicle.status == VehicleStatus.LOST else 1.0
    factor = availability * status_factor
    return CapabilityVector(
        visual_recon=clamp01(vehicle.capabilities.visual_recon * factor),
        relay=clamp01(vehicle.capabilities.relay * factor),
        overwatch=clamp01(vehicle.capabilities.overwatch * factor),
        gps_denied_nav=clamp01(vehicle.capabilities.gps_denied_nav * factor),
        reserve=clamp01(vehicle.capabilities.reserve * factor),
    )


def compute_capability_report(
    vehicles: tuple[Vehicle, ...],
    mission: Mission,
    assignments: tuple[Assignment, ...],
) -> CapabilityReport:
    effective = {vehicle.id: effective_capability(vehicle) for vehicle in vehicles}
    area_reports: dict[str, AreaCoverage] = {}
    weighted_mcc_total = 0.0
    weighted_deficit_total = 0.0

    for area in mission.areas:
        requirement = mission.requirements[area]
        coverage: dict[str, float] = {}
        deficit: dict[str, float] = {}
        for capability in CAPABILITY_NAMES:
            demand = requirement.required_for(capability)
            supply = _supply_for_area(
                area=area,
                capability=capability,
                assignments=assignments,
                effective=effective,
            )
            score = clamp01(supply / (demand + EPSILON)) if demand > 0 else 1.0
            gap = clamp01((demand - supply) / (demand + EPSILON)) if demand > 0 else 0.0
            coverage[capability.value] = round(score, 3)
            deficit[capability.value] = round(gap, 3)
            weighted_mcc_total += score
            weighted_deficit_total += gap
        area_reports[area] = AreaCoverage(area=area, coverage=coverage, deficit=deficit)

    denominator = float(len(mission.areas) * len(CAPABILITY_NAMES))
    return CapabilityReport(
        effective_capabilities=effective,
        area_reports=area_reports,
        overall_mcc=round(clamp01(weighted_mcc_total / denominator), 3),
        deficit_score=round(clamp01(weighted_deficit_total / denominator), 3),
    )


def _supply_for_area(
    area: str,
    capability: CapabilityName,
    assignments: tuple[Assignment, ...],
    effective: dict[str, CapabilityVector],
) -> float:
    supply = 0.0
    for assignment in assignments:
        vehicle_capability = effective.get(assignment.vehicle_id)
        if assignment.area == area and vehicle_capability is not None:
            supply += vehicle_capability.value_for(capability) * assignment.weight
    return supply
