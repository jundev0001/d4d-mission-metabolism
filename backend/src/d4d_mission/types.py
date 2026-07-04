from __future__ import annotations

from enum import StrEnum, unique
from typing import Final

type VehicleId = str
type MissionId = str
type AreaId = str
type RecommendationId = str


@unique
class MissionType(StrEnum):
    AREA_RECON = "area_recon"
    ROUTE_RECON = "route_recon"
    PERSISTENT_WATCH = "persistent_watch"
    PERIMETER_SECURITY = "perimeter_security"
    COMM_RELAY = "comm_relay"
    GPS_DENIED_SCOUT = "gps_denied_scout"
    DAMAGE_ASSESSMENT = "damage_assessment"


@unique
class CapabilityName(StrEnum):
    VISUAL_RECON = "visual_recon"
    RELAY = "relay"
    OVERWATCH = "overwatch"
    GPS_DENIED_NAV = "gps_denied_nav"
    RESERVE = "reserve"


@unique
class VehicleType(StrEnum):
    MICRO_SCOUT_UAV = "micro_scout_uav"
    QUAD_RECON_UAV = "quad_recon_uav"
    FIXEDWING_SURVEY_UAV = "fixedwing_survey_uav"
    RELAY_UAV = "relay_uav"
    OVERWATCH_UAV = "overwatch_uav"
    GPS_DENIED_UAV = "gps_denied_uav"
    SCOUT_ROVER = "scout_rover"
    SENSOR_ROVER = "sensor_rover"
    SYNTHETIC_WINGMAN = "synthetic_wingman"


@unique
class VehicleStatus(StrEnum):
    ACTIVE = "active"
    RETURNING = "returning"
    LOST = "lost"
    STANDBY = "standby"


@unique
class EventType(StrEnum):
    COMM_JAM = "comm_jam"
    GPS_DROP = "gps_drop"
    BATTERY_DROP = "battery_drop"
    SENSOR_FAIL = "sensor_fail"
    VEHICLE_LOST = "vehicle_lost"
    ALERT_FLOOD = "alert_flood"
    COMM_DEGRADED = "comm_degraded"
    NO_GO = "no_go"
    PRIORITY_SHIFT = "priority_shift"


@unique
class DecisionAction(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"
    MANUAL = "manual"


@unique
class RecommendationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL = "manual"


@unique
class MicroActionType(StrEnum):
    RETURN = "return"
    REPLACE = "replace"
    REPOSITION_RELAY = "reposition_relay"
    LOW_BANDWIDTH = "low_bandwidth"
    HOLD = "hold"
    SUPPRESS_ALERTS = "suppress_alerts"
    REDISTRIBUTE_COVERAGE = "redistribute_coverage"


CAPABILITY_NAMES: Final = (
    CapabilityName.VISUAL_RECON,
    CapabilityName.RELAY,
    CapabilityName.OVERWATCH,
    CapabilityName.GPS_DENIED_NAV,
    CapabilityName.RESERVE,
)

MISSION_TYPES: Final = (
    MissionType.AREA_RECON,
    MissionType.ROUTE_RECON,
    MissionType.PERSISTENT_WATCH,
    MissionType.PERIMETER_SECURITY,
    MissionType.COMM_RELAY,
    MissionType.GPS_DENIED_SCOUT,
    MissionType.DAMAGE_ASSESSMENT,
)

DEPLOYABLE_VEHICLE_TYPES: Final = (
    VehicleType.MICRO_SCOUT_UAV,
    VehicleType.QUAD_RECON_UAV,
    VehicleType.FIXEDWING_SURVEY_UAV,
    VehicleType.RELAY_UAV,
    VehicleType.OVERWATCH_UAV,
    VehicleType.GPS_DENIED_UAV,
    VehicleType.SCOUT_ROVER,
    VehicleType.SENSOR_ROVER,
)
