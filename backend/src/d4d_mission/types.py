from __future__ import annotations

from enum import StrEnum, unique
from typing import Final

type VehicleId = str
type MissionId = str
type AreaId = str
type RecommendationId = str


@unique
class CapabilityName(StrEnum):
    VISUAL_RECON = "visual_recon"
    RELAY = "relay"
    OVERWATCH = "overwatch"
    GPS_DENIED_NAV = "gps_denied_nav"
    RESERVE = "reserve"


@unique
class VehicleType(StrEnum):
    UAV = "UAV"
    UGV = "UGV"
    SYNTHETIC = "Synthetic Wingman"


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
