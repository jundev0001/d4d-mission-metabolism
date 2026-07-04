from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, override

if TYPE_CHECKING:
    from pathlib import Path

from d4d_mission.blackbox import JsonlBlackBox
from d4d_mission.immune import (
    ManualActionError,
    RecommendationNotFoundError,
    decide_recommendation,
)
from d4d_mission.immune_cards import build_recommendation
from d4d_mission.models import (
    AllocationResponse,
    CapabilityReport,
    DashboardState,
    DecisionRequest,
    EventRequest,
    FleetStateResponse,
    MetricSnapshot,
    RecommendationCard,
    ReplayResponse,
)
from d4d_mission.scenario import apply_event_to_snapshot, create_initial_snapshot
from d4d_mission.types import EventType

AREA_TARGET_EVENTS = frozenset(
    {
        EventType.COMM_JAM,
        EventType.NO_GO,
        EventType.PRIORITY_SHIFT,
        EventType.DATA_STALE,
        EventType.TARGET_DETECTED,
        EventType.WEATHER_DEGRADED,
        EventType.ASSET_ADDED,
        EventType.RESERVE_DEPLETED,
    }
)
VEHICLE_TARGET_EVENTS = frozenset(
    {
        EventType.BATTERY_DROP,
        EventType.COMM_DEGRADED,
        EventType.GPS_DROP,
        EventType.SENSOR_FAIL,
        EventType.VEHICLE_LOST,
        EventType.MOBILITY_BLOCKED,
        EventType.COLLISION_RISK,
        EventType.SENSOR_CONFIDENCE_DROP,
    }
)


@dataclass(frozen=True, slots=True)
class UnknownTargetError(Exception):
    target: str

    @override
    def __str__(self) -> str:
        return f"unknown target {self.target}"


class MissionRuntime:
    def __init__(self, log_path: Path) -> None:
        self._blackbox: JsonlBlackBox = JsonlBlackBox(path=log_path)
        self._snapshot: DashboardState = create_initial_snapshot()
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="mission",
            summary="mission initialized",
            model=self._snapshot,
        )

    @property
    def snapshot(self) -> DashboardState:
        return self._snapshot

    def reset(self, seed: int) -> DashboardState:
        self._snapshot = create_initial_snapshot(seed=seed)
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="mission",
            summary=f"mission reset with seed {seed}",
            model=self._snapshot,
        )
        return self._snapshot

    def fleet_state(self) -> FleetStateResponse:
        return FleetStateResponse(vehicles=self._snapshot.vehicles)

    def capability_report(self) -> CapabilityReport:
        return self._snapshot.capability_report

    def allocation(self) -> AllocationResponse:
        explanations = (
            "UxV-04 anchors B-area relay because relay capability is strongest.",
            "UxV-06 is preserved as reserve until collapse risk rises.",
            "Synthetic wingmen hide mixed-fidelity differences from the operator.",
        )
        return AllocationResponse(assignments=self._snapshot.assignments, explanations=explanations)

    def inject_event(self, event: EventRequest) -> DashboardState:
        self._ensure_target_exists(event=event)
        card = build_recommendation(snapshot=self._snapshot, event=event)
        self._snapshot = apply_event_to_snapshot(
            snapshot=self._snapshot,
            event=event,
            recommendation=card,
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="event",
            summary=f"{event.event_type.value} injected for {event.target}",
            model=event,
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="recommendation",
            summary=card.title,
            model=card,
        )
        return self._snapshot

    def respond(self, event: EventRequest) -> RecommendationCard:
        self._ensure_target_exists(event=event)
        return build_recommendation(snapshot=self._snapshot, event=event)

    def decide(self, request: DecisionRequest) -> DashboardState:
        self._snapshot = decide_recommendation(snapshot=self._snapshot, request=request)
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="decision",
            summary=f"{request.action.value} {request.recommendation_id}",
            model=request,
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="outcome",
            summary="metrics recomputed after human gate",
            model=self._snapshot.metrics,
        )
        return self._snapshot

    def metrics(self) -> MetricSnapshot:
        return self._snapshot.metrics

    def replay(self) -> ReplayResponse:
        return ReplayResponse(entries=self._blackbox.entries())

    def _ensure_target_exists(self, event: EventRequest) -> None:
        if event.event_type in AREA_TARGET_EVENTS:
            if event.target not in self._snapshot.mission.areas:
                raise UnknownTargetError(target=event.target)
            return

        if event.event_type in VEHICLE_TARGET_EVENTS:
            vehicle_ids = {vehicle.id for vehicle in self._snapshot.vehicles}
            if event.target not in vehicle_ids:
                raise UnknownTargetError(target=event.target)
            return

        if event.event_type is not EventType.ALERT_FLOOD:
            msg = f"unsupported event type: {event.event_type}"
            raise ValueError(msg)


def runtime_error_to_status(error: Exception) -> int:
    if isinstance(error, UnknownTargetError):
        return 404
    if isinstance(error, (RecommendationNotFoundError, ManualActionError)):
        return 400
    raise error
