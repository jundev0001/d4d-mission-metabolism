from __future__ import annotations

from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field

from d4d_mission.types import (
    AreaId,
    CapabilityName,
    DecisionAction,
    EventType,
    MicroActionType,
    MissionId,
    MissionType,
    RecommendationId,
    RecommendationStatus,
    VehicleId,
    VehicleStatus,
    VehicleType,
)


class StrictModel(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")


class HealthState(StrictModel):
    battery: float = Field(ge=0, le=1)
    comm: float = Field(ge=0, le=1)
    nav: float = Field(ge=0, le=1)
    sensor: float = Field(ge=0, le=1)
    health: float = Field(ge=0, le=1)
    confidence: float = Field(default=0.9, ge=0, le=1)
    degradation_reason: str = ""


class CapabilityVector(StrictModel):
    visual_recon: float = Field(ge=0, le=1)
    relay: float = Field(ge=0, le=1)
    overwatch: float = Field(ge=0, le=1)
    gps_denied_nav: float = Field(ge=0, le=1)
    reserve: float = Field(ge=0, le=1)

    def value_for(self, capability: CapabilityName) -> float:
        values = {
            CapabilityName.VISUAL_RECON: self.visual_recon,
            CapabilityName.RELAY: self.relay,
            CapabilityName.OVERWATCH: self.overwatch,
            CapabilityName.GPS_DENIED_NAV: self.gps_denied_nav,
            CapabilityName.RESERVE: self.reserve,
        }
        return values[capability]


class Point(StrictModel):
    x: float
    y: float


class Vehicle(StrictModel):
    id: VehicleId
    type: VehicleType
    label: str
    area: AreaId
    role: CapabilityName
    position: Point
    velocity: Point
    health: HealthState
    capabilities: CapabilityVector
    status: VehicleStatus = VehicleStatus.ACTIVE
    synthetic: bool = False


class CapabilityDemand(StrictModel):
    visual_recon: float = Field(ge=0)
    relay: float = Field(ge=0)
    overwatch: float = Field(ge=0)
    gps_denied_nav: float = Field(ge=0)
    reserve: float = Field(ge=0)

    def required_for(self, capability: CapabilityName) -> float:
        requirements = {
            CapabilityName.VISUAL_RECON: self.visual_recon,
            CapabilityName.RELAY: self.relay,
            CapabilityName.OVERWATCH: self.overwatch,
            CapabilityName.GPS_DENIED_NAV: self.gps_denied_nav,
            CapabilityName.RESERVE: self.reserve,
        }
        return requirements[capability]


class MissionConstraints(StrictModel):
    return_battery_threshold: float = Field(default=0.2, ge=0, le=1)
    min_relay_redundancy: int = Field(default=1, ge=0)
    human_approval_for_replan: bool = True
    target_mcc: float = Field(default=0.8, ge=0, le=1)


class Mission(StrictModel):
    id: MissionId
    mission_type: MissionType
    objective: str
    areas: tuple[AreaId, ...]
    requirements: dict[AreaId, CapabilityDemand]
    constraints: MissionConstraints
    autonomy_level: float = Field(default=0.62, ge=0, le=1)
    area_threats: dict[AreaId, float] = Field(default_factory=dict)
    area_priorities: dict[AreaId, float] = Field(default_factory=dict)
    area_centers: dict[AreaId, Point] = Field(default_factory=dict)
    area_mission_types: dict[AreaId, MissionType] = Field(default_factory=dict)
    no_go_areas: tuple[AreaId, ...] = ()


class Assignment(StrictModel):
    vehicle_id: VehicleId
    area: AreaId
    role: CapabilityName
    weight: float = Field(default=1, ge=0, le=1)


class MissionTemplate(StrictModel):
    mission_type: MissionType
    label: str
    description: str
    demand: CapabilityDemand
    priority_capabilities: tuple[CapabilityName, ...]


class VehicleTypeProfile(StrictModel):
    vehicle_type: VehicleType
    label: str
    platform: str
    primary_role: CapabilityName
    capabilities: CapabilityVector
    endurance: float = Field(ge=0, le=1)
    speed: float = Field(ge=0, le=1)
    terrain_notes: tuple[str, ...]


class EventRequest(StrictModel):
    event_type: EventType
    target: str
    severity: float = Field(ge=0, le=1)


class EventRecord(EventRequest):
    id: str
    scenario_time: int
    summary: str


class AreaCoverage(StrictModel):
    area: AreaId
    coverage: dict[str, float]
    deficit: dict[str, float]


class CapabilityReport(StrictModel):
    effective_capabilities: dict[VehicleId, CapabilityVector]
    area_reports: dict[AreaId, AreaCoverage]
    overall_mcc: float = Field(ge=0, le=1)
    deficit_score: float = Field(ge=0, le=1)


class CapabilityGap(StrictModel):
    area: AreaId
    capability: CapabilityName
    demand: float = Field(ge=0)
    supply: float = Field(ge=0)
    deficit_ratio: float = Field(ge=0, le=1)
    deficit_absolute: float = Field(ge=0)
    contributor_count: int = Field(ge=0)
    single_point: bool
    priority: float = Field(ge=0)


class CapabilityGapReport(StrictModel):
    gaps: tuple[CapabilityGap, ...]


class MetricSnapshot(StrictModel):
    mcc: float = Field(ge=0, le=1)
    strain: float = Field(ge=0, le=1)
    collapse_probability: float = Field(ge=0, le=1)
    autonomy_debt: float = Field(ge=0, le=100)
    operator_actions: int = Field(ge=0)
    alert_backlog: int = Field(ge=0)
    approval_count: int = Field(ge=0)
    replan_time_seconds: float = Field(ge=0)
    ccr_external: float = Field(ge=0)
    ccr_internal: float = Field(ge=0)


class CalculationTrace(StrictModel):
    trigger: str
    mcc: float = Field(ge=0, le=1)
    baseline_mcc: float = Field(ge=0, le=1)
    collapse_probability: float = Field(ge=0, le=1)
    autonomy_debt: float = Field(ge=0, le=100)
    ccr_external: float = Field(ge=0)
    ccr_internal: float = Field(ge=0)
    pending_recommendations: int = Field(ge=0)
    assigned_assets: int = Field(ge=0)
    area_mcc: dict[AreaId, float]


class KpiDelta(StrictModel):
    mcc_delta: float
    collapse_probability_delta: float
    autonomy_debt_delta: float
    operator_actions_delta: int


class MicroAction(StrictModel):
    vehicle_id: VehicleId
    action: MicroActionType
    area: AreaId | None = None
    rationale: str


class RecommendationCard(StrictModel):
    id: RecommendationId
    severity: str
    title: str
    causes: tuple[str, ...]
    actions: tuple[MicroAction, ...]
    expected_effect: KpiDelta
    status: RecommendationStatus = RecommendationStatus.PENDING
    event_id: str | None = None


class DecisionRequest(StrictModel):
    recommendation_id: RecommendationId
    action: DecisionAction
    manual_action: MicroActionType | None = None
    vehicle_id: VehicleId | None = None


class BlackBoxEntry(StrictModel):
    id: str
    scenario_time: int
    kind: str
    summary: str
    payload_json: str


class FleetStateResponse(StrictModel):
    vehicles: tuple[Vehicle, ...]


class AllocationResponse(StrictModel):
    assignments: tuple[Assignment, ...]
    explanations: tuple[str, ...]


class ReplayResponse(StrictModel):
    entries: tuple[BlackBoxEntry, ...]


class MissionCatalogResponse(StrictModel):
    templates: tuple[MissionTemplate, ...]


class VehicleTypeCatalogResponse(StrictModel):
    profiles: tuple[VehicleTypeProfile, ...]


class DashboardState(StrictModel):
    mission: Mission
    vehicles: tuple[Vehicle, ...]
    assignments: tuple[Assignment, ...]
    metrics: MetricSnapshot
    baseline_metrics: MetricSnapshot
    capability_report: CapabilityReport
    recommendations: tuple[RecommendationCard, ...]
    events: tuple[EventRecord, ...]
    scenario_time: int
    baseline_operator_actions: int
    assisted_operator_actions: int
    system_micro_actions: int
    human_intents: int
    recovery_actions: int
    baseline_mission: Mission | None = Field(default=None, exclude=True)
    baseline_vehicles: tuple[Vehicle, ...] = Field(default=(), exclude=True)
    baseline_assignments: tuple[Assignment, ...] = Field(default=(), exclude=True)
