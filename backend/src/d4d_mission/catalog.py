from __future__ import annotations

from typing import Final

from d4d_mission.models import (
    CapabilityDemand,
    CapabilityVector,
    MissionTemplate,
    VehicleTypeProfile,
)
from d4d_mission.types import (
    DEPLOYABLE_VEHICLE_TYPES,
    MISSION_TYPES,
    CapabilityName,
    MissionType,
    VehicleType,
)

MISSION_TEMPLATES: Final[dict[MissionType, MissionTemplate]] = {
    MissionType.AREA_RECON: MissionTemplate(
        mission_type=MissionType.AREA_RECON,
        label="Area reconnaissance",
        description="Reduce unknowns across a bounded area and refresh stale cells.",
        demand=CapabilityDemand(
            visual_recon=0.9,
            relay=0.4,
            overwatch=0.2,
            gps_denied_nav=0.2,
            reserve=0.4,
        ),
        priority_capabilities=(CapabilityName.VISUAL_RECON, CapabilityName.RELAY),
    ),
    MissionType.ROUTE_RECON: MissionTemplate(
        mission_type=MissionType.ROUTE_RECON,
        label="Route reconnaissance",
        description="Check a movement corridor for obstacles, threats, and navigation risk.",
        demand=CapabilityDemand(
            visual_recon=0.75,
            relay=0.35,
            overwatch=0.25,
            gps_denied_nav=0.65,
            reserve=0.45,
        ),
        priority_capabilities=(CapabilityName.VISUAL_RECON, CapabilityName.GPS_DENIED_NAV),
    ),
    MissionType.PERSISTENT_WATCH: MissionTemplate(
        mission_type=MissionType.PERSISTENT_WATCH,
        label="Persistent watch",
        description="Hold continuous coverage over a high-value area or detected activity.",
        demand=CapabilityDemand(
            visual_recon=0.5,
            relay=0.6,
            overwatch=0.95,
            gps_denied_nav=0.2,
            reserve=0.5,
        ),
        priority_capabilities=(CapabilityName.OVERWATCH, CapabilityName.RELAY),
    ),
    MissionType.PERIMETER_SECURITY: MissionTemplate(
        mission_type=MissionType.PERIMETER_SECURITY,
        label="Perimeter security",
        description="Maintain watch around a base, convoy halt, or protected boundary.",
        demand=CapabilityDemand(
            visual_recon=0.65,
            relay=0.55,
            overwatch=0.8,
            gps_denied_nav=0.35,
            reserve=0.45,
        ),
        priority_capabilities=(CapabilityName.OVERWATCH, CapabilityName.VISUAL_RECON),
    ),
    MissionType.COMM_RELAY: MissionTemplate(
        mission_type=MissionType.COMM_RELAY,
        label="Communications relay",
        description="Preserve network continuity across distance, terrain, or EW pressure.",
        demand=CapabilityDemand(
            visual_recon=0.1,
            relay=1.0,
            overwatch=0.2,
            gps_denied_nav=0.2,
            reserve=0.6,
        ),
        priority_capabilities=(CapabilityName.RELAY, CapabilityName.RESERVE),
    ),
    MissionType.GPS_DENIED_SCOUT: MissionTemplate(
        mission_type=MissionType.GPS_DENIED_SCOUT,
        label="GPS-denied scout",
        description="Reconnoiter a jammed, indoor, forested, urban, or canyon-like area.",
        demand=CapabilityDemand(
            visual_recon=0.7,
            relay=0.55,
            overwatch=0.25,
            gps_denied_nav=0.95,
            reserve=0.45,
        ),
        priority_capabilities=(CapabilityName.GPS_DENIED_NAV, CapabilityName.VISUAL_RECON),
    ),
    MissionType.DAMAGE_ASSESSMENT: MissionTemplate(
        mission_type=MissionType.DAMAGE_ASSESSMENT,
        label="Damage assessment",
        description="Inspect an incident area and confirm degraded infrastructure or effects.",
        demand=CapabilityDemand(
            visual_recon=0.85,
            relay=0.45,
            overwatch=0.3,
            gps_denied_nav=0.35,
            reserve=0.55,
        ),
        priority_capabilities=(CapabilityName.VISUAL_RECON, CapabilityName.RESERVE),
    ),
}

VEHICLE_TYPE_PROFILES: Final[dict[VehicleType, VehicleTypeProfile]] = {
    VehicleType.MICRO_SCOUT_UAV: VehicleTypeProfile(
        vehicle_type=VehicleType.MICRO_SCOUT_UAV,
        label="Micro scout UAV",
        platform="air",
        primary_role=CapabilityName.VISUAL_RECON,
        capabilities=CapabilityVector(
            visual_recon=0.65,
            relay=0.18,
            overwatch=0.3,
            gps_denied_nav=0.28,
            reserve=0.75,
        ),
        endurance=0.35,
        speed=0.58,
        terrain_notes=("dense urban", "indoor edge", "short endurance"),
    ),
    VehicleType.QUAD_RECON_UAV: VehicleTypeProfile(
        vehicle_type=VehicleType.QUAD_RECON_UAV,
        label="Quad recon UAV",
        platform="air",
        primary_role=CapabilityName.VISUAL_RECON,
        capabilities=CapabilityVector(
            visual_recon=0.88,
            relay=0.3,
            overwatch=0.62,
            gps_denied_nav=0.42,
            reserve=0.35,
        ),
        endurance=0.55,
        speed=0.5,
        terrain_notes=("precision hover", "forest canopy penalty", "close inspection"),
    ),
    VehicleType.FIXEDWING_SURVEY_UAV: VehicleTypeProfile(
        vehicle_type=VehicleType.FIXEDWING_SURVEY_UAV,
        label="Fixed-wing survey UAV",
        platform="air",
        primary_role=CapabilityName.VISUAL_RECON,
        capabilities=CapabilityVector(
            visual_recon=0.92,
            relay=0.35,
            overwatch=0.45,
            gps_denied_nav=0.38,
            reserve=0.5,
        ),
        endurance=0.86,
        speed=0.9,
        terrain_notes=("wide-area sweep", "turn radius constraint", "poor hover"),
    ),
    VehicleType.RELAY_UAV: VehicleTypeProfile(
        vehicle_type=VehicleType.RELAY_UAV,
        label="Relay UAV",
        platform="air",
        primary_role=CapabilityName.RELAY,
        capabilities=CapabilityVector(
            visual_recon=0.35,
            relay=0.95,
            overwatch=0.42,
            gps_denied_nav=0.45,
            reserve=0.58,
        ),
        endurance=0.78,
        speed=0.48,
        terrain_notes=("high perch", "network bridge", "EW recovery"),
    ),
    VehicleType.OVERWATCH_UAV: VehicleTypeProfile(
        vehicle_type=VehicleType.OVERWATCH_UAV,
        label="Overwatch UAV",
        platform="air",
        primary_role=CapabilityName.OVERWATCH,
        capabilities=CapabilityVector(
            visual_recon=0.7,
            relay=0.5,
            overwatch=0.95,
            gps_denied_nav=0.38,
            reserve=0.42,
        ),
        endurance=0.82,
        speed=0.42,
        terrain_notes=("persistent orbit", "stabilized sensor", "area hold"),
    ),
    VehicleType.GPS_DENIED_UAV: VehicleTypeProfile(
        vehicle_type=VehicleType.GPS_DENIED_UAV,
        label="GPS-denied UAV",
        platform="air",
        primary_role=CapabilityName.GPS_DENIED_NAV,
        capabilities=CapabilityVector(
            visual_recon=0.72,
            relay=0.34,
            overwatch=0.45,
            gps_denied_nav=0.95,
            reserve=0.38,
        ),
        endurance=0.6,
        speed=0.52,
        terrain_notes=("SLAM capable", "jammed zone", "urban canyon"),
    ),
    VehicleType.SCOUT_ROVER: VehicleTypeProfile(
        vehicle_type=VehicleType.SCOUT_ROVER,
        label="Scout rover",
        platform="ground",
        primary_role=CapabilityName.VISUAL_RECON,
        capabilities=CapabilityVector(
            visual_recon=0.62,
            relay=0.22,
            overwatch=0.45,
            gps_denied_nav=0.82,
            reserve=0.48,
        ),
        endurance=0.72,
        speed=0.25,
        terrain_notes=("under canopy", "close confirmation", "slow mobility"),
    ),
    VehicleType.SENSOR_ROVER: VehicleTypeProfile(
        vehicle_type=VehicleType.SENSOR_ROVER,
        label="Sensor rover",
        platform="ground",
        primary_role=CapabilityName.OVERWATCH,
        capabilities=CapabilityVector(
            visual_recon=0.48,
            relay=0.3,
            overwatch=0.92,
            gps_denied_nav=0.72,
            reserve=0.52,
        ),
        endurance=0.88,
        speed=0.18,
        terrain_notes=("long dwell", "ground truth", "static sensor node"),
    ),
}


def mission_templates() -> tuple[MissionTemplate, ...]:
    return tuple(MISSION_TEMPLATES[mission_type] for mission_type in MISSION_TYPES)


def vehicle_type_profiles() -> tuple[VehicleTypeProfile, ...]:
    return tuple(VEHICLE_TYPE_PROFILES[vehicle_type] for vehicle_type in DEPLOYABLE_VEHICLE_TYPES)


def mission_template(mission_type: MissionType) -> MissionTemplate:
    return MISSION_TEMPLATES[mission_type]


def vehicle_type_profile(vehicle_type: VehicleType) -> VehicleTypeProfile:
    return VEHICLE_TYPE_PROFILES[vehicle_type]
