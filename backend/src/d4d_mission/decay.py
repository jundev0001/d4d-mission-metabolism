from __future__ import annotations

from typing import Final

from d4d_mission.capability import clamp01, effective_capability
from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.models import CapabilityVector, Mission, Vehicle
from d4d_mission.types import DEPLOYABLE_VEHICLE_TYPES, VehicleType

HORIZON_STEPS: Final = 3
BATTERY_STEP_DRAIN: Final = 0.05
COMM_THREAT_DECAY: Final = 0.16
SENSOR_THREAT_DECAY: Final = 0.06
NAV_THREAT_DECAY: Final = 0.05
DEFAULT_ENDURANCE: Final = 0.6
DEFAULT_RESILIENCE: Final = 0.3
MIN_ENDURANCE: Final = 0.2

# Per-type electronic-warfare resilience in [0, 1]: 1 = comm/sensor hold under
# jamming, 0 = degrade fast. Relay and GPS-denied airframes are EW-hardened;
# the small attritable scout is the most fragile.
EW_RESILIENCE: Final[dict[VehicleType, float]] = {
    VehicleType.MICRO_SCOUT_UAV: 0.2,
    VehicleType.QUAD_RECON_UAV: 0.35,
    VehicleType.FIXEDWING_SURVEY_UAV: 0.4,
    VehicleType.RELAY_UAV: 0.8,
    VehicleType.OVERWATCH_UAV: 0.55,
    VehicleType.GPS_DENIED_UAV: 0.75,
    VehicleType.SCOUT_ROVER: 0.5,
    VehicleType.SENSOR_ROVER: 0.55,
    VehicleType.SYNTHETIC_WINGMAN: 0.3,
}


def project_vehicle(vehicle: Vehicle, mission: Mission, area: str, steps: int) -> Vehicle:
    """Project a vehicle `steps` ahead as if it operates in `area`.

    Battery drains at a rate set by the type endurance (short-endurance types
    drain fast). Comm/sensor/nav degrade with the area threat, softened by the
    type EW resilience. Raw capability values are unchanged; only condition
    (health) decays, which lowers effective capability.
    """
    if steps <= 0:
        return vehicle
    endurance = _endurance(vehicle.type)
    exposure = mission.area_threats.get(area, 0.0) * (1.0 - _resilience(vehicle.type))
    health = vehicle.health
    projected = health.model_copy(
        update={
            "battery": clamp01(health.battery - (steps * (BATTERY_STEP_DRAIN / endurance))),
            "comm": clamp01(health.comm - (steps * COMM_THREAT_DECAY * exposure)),
            "sensor": clamp01(health.sensor - (steps * SENSOR_THREAT_DECAY * exposure)),
            "nav": clamp01(health.nav - (steps * NAV_THREAT_DECAY * exposure)),
        },
    )
    return vehicle.model_copy(update={"health": projected})


def horizon_capability(
    vehicle: Vehicle,
    mission: Mission,
    area: str,
    horizon: int = HORIZON_STEPS,
) -> CapabilityVector:
    """Worst-case effective capability over t+1..t+horizon in `area`.

    Taking the per-step minimum makes the allocator prefer assets that keep
    delivering a capability across the horizon instead of ones that only
    satisfy the current snapshot. With ``horizon <= 0`` this reduces to the
    instantaneous effective capability.
    """
    if horizon <= 0:
        return effective_capability(vehicle)
    projections = [
        effective_capability(project_vehicle(vehicle, mission, area, step))
        for step in range(1, horizon + 1)
    ]
    return CapabilityVector(
        visual_recon=min(projection.visual_recon for projection in projections),
        relay=min(projection.relay for projection in projections),
        overwatch=min(projection.overwatch for projection in projections),
        gps_denied_nav=min(projection.gps_denied_nav for projection in projections),
        reserve=min(projection.reserve for projection in projections),
    )


def _endurance(vehicle_type: VehicleType) -> float:
    if vehicle_type in DEPLOYABLE_VEHICLE_TYPES:
        return max(vehicle_type_profile(vehicle_type).endurance, MIN_ENDURANCE)
    return DEFAULT_ENDURANCE


def _resilience(vehicle_type: VehicleType) -> float:
    return EW_RESILIENCE.get(vehicle_type, DEFAULT_RESILIENCE)
