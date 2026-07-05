from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from d4d_mission.allocation_movement import GCS_AREA
from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.types import DEPLOYABLE_VEHICLE_TYPES, CapabilityName, VehicleStatus

if TYPE_CHECKING:
    from d4d_mission.models import Mission, Vehicle

BATTERY_PENALTY_WEIGHT: Final = 1.65
NO_GO_PENALTY: Final = 1.15
THREAT_PENALTY_WEIGHT: Final = 0.24
CHURN_PENALTY: Final = 0.12
RESERVE_PRESERVATION_WEIGHT: Final = 0.08
SAME_AREA_BONUS: Final = 0.06
ROLE_FIT_BONUS: Final = 0.05
TYPE_FIT_BONUS: Final = 0.12
CAPABILITY_STRENGTH_WEIGHT: Final = 0.18
FOCUSED_COVERAGE_WEIGHT: Final = 0.28


@dataclass(frozen=True, slots=True)
class CandidateUtilityInput:
    vehicle: Vehicle
    mission: Mission
    area: str
    capability: CapabilityName
    total_covered: float
    capability_covered: float
    priority: float
    movement_cost: float
    battery_margin: float


def area_urgency(mission: Mission, area: str) -> float:
    priority = mission.area_priorities.get(area, 0.5)
    threat = mission.area_threats.get(area, 0.0)
    return 1.0 + priority + (threat * 0.25)


def capability_fit_score(vehicle: Vehicle, capability: CapabilityName) -> float:
    primary_role = (
        vehicle_type_profile(vehicle.type).primary_role
        if vehicle.type in DEPLOYABLE_VEHICLE_TYPES
        else vehicle.role
    )
    type_fit = TYPE_FIT_BONUS if primary_role == capability else 0.0
    role_fit = ROLE_FIT_BONUS if vehicle.role == capability else 0.0
    strength = vehicle.capabilities.value_for(capability) * CAPABILITY_STRENGTH_WEIGHT
    return type_fit + role_fit + strength


def candidate_utility(candidate: CandidateUtilityInput) -> float:
    focused_gain = candidate.capability_covered * FOCUSED_COVERAGE_WEIGHT
    broad_gain = candidate.total_covered * (1.0 - FOCUSED_COVERAGE_WEIGHT)
    base_gain = (broad_gain + focused_gain) * candidate.priority
    no_go_penalty = NO_GO_PENALTY if candidate.area in candidate.mission.no_go_areas else 0.0
    battery_penalty = max(0.0, -candidate.battery_margin) * BATTERY_PENALTY_WEIGHT
    return (
        base_gain
        + capability_fit_score(vehicle=candidate.vehicle, capability=candidate.capability)
        + _same_area_bonus(vehicle=candidate.vehicle, area=candidate.area)
        - candidate.movement_cost
        - no_go_penalty
        - battery_penalty
        - _threat_penalty(
            vehicle=candidate.vehicle,
            mission=candidate.mission,
            area=candidate.area,
        )
        - _churn_penalty(vehicle=candidate.vehicle, area=candidate.area)
        - _reserve_preservation_penalty(
            vehicle=candidate.vehicle,
            capability=candidate.capability,
        )
    )


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


def _reserve_preservation_penalty(vehicle: Vehicle, capability: CapabilityName) -> float:
    if vehicle.status != VehicleStatus.STANDBY or capability == CapabilityName.RESERVE:
        return 0.0
    return vehicle.capabilities.reserve * RESERVE_PRESERVATION_WEIGHT
