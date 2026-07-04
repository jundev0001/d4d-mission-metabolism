from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

    from d4d_mission.types import VehicleId, VehicleStatus

from d4d_mission.allocator import apply_allocation_to_vehicles, plan_allocation
from d4d_mission.battery_rotation import add_battery_rotation_recommendation
from d4d_mission.blackbox import JsonlBlackBox
from d4d_mission.capability_gap import analyze_capability_gaps
from d4d_mission.deployment import DeploymentCount, DeploymentError, apply_fleet_deployment
from d4d_mission.immune import (
    ManualActionError,
    RecommendationNotFoundError,
    decide_recommendation,
    find_recommendation,
)
from d4d_mission.immune_cards import build_recommendation
from d4d_mission.models import (
    AllocationResponse,
    CapabilityGapReport,
    CapabilityReport,
    DashboardState,
    DecisionRequest,
    EventRequest,
    FleetStateResponse,
    HealthState,
    MetricSnapshot,
    Mission,
    RecommendationCard,
    ReplayResponse,
)
from d4d_mission.runtime_support import (
    AREA_TARGET_EVENTS,
    VEHICLE_TARGET_EVENTS,
    UnknownTargetError,
    advance_time_snapshot,
    record_calculation,
    refresh_allocation_snapshot,
    tune_vehicle_snapshot,
)
from d4d_mission.scenario import (
    apply_event_to_snapshot,
    create_initial_snapshot,
    refresh_snapshot,
)


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
        record_calculation(self._blackbox, self._snapshot, "mission_initialized")

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
        record_calculation(self._blackbox, self._snapshot, "mission_reset")
        return self._snapshot

    def deploy_fleet(self, deployment: tuple[DeploymentCount, ...]) -> DashboardState:
        self._snapshot = apply_fleet_deployment(snapshot=self._snapshot, deployment=deployment)
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="mission",
            summary="fleet deployment updated",
            model=self._snapshot,
        )
        record_calculation(self._blackbox, self._snapshot, "fleet_deployment")
        return self._snapshot

    def configure_mission(self, mission: Mission) -> DashboardState:
        staged_vehicles = apply_allocation_to_vehicles(
            vehicles=self._snapshot.vehicles,
            assignments=(),
            mission=mission,
        )
        self._snapshot = refresh_snapshot(
            snapshot=self._snapshot.model_copy(
                update={
                    "mission": mission,
                    "vehicles": staged_vehicles,
                    "assignments": (),
                    "baseline_mission": mission,
                    "baseline_vehicles": staged_vehicles,
                    "baseline_assignments": (),
                    "recommendations": (),
                    "events": (),
                    "scenario_time": 0,
                },
            ),
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="mission",
            summary="mission configured from custom areas",
            model=mission,
        )
        record_calculation(self._blackbox, self._snapshot, "mission_configure")
        return self._snapshot

    def fleet_state(self) -> FleetStateResponse:
        return FleetStateResponse(vehicles=self._snapshot.vehicles)

    def capability_report(self) -> CapabilityReport:
        return self._snapshot.capability_report

    def capability_gaps(self) -> CapabilityGapReport:
        return CapabilityGapReport(
            gaps=analyze_capability_gaps(
                vehicles=self._snapshot.vehicles,
                mission=self._snapshot.mission,
                assignments=self._snapshot.assignments,
            ),
        )

    def allocation(self) -> AllocationResponse:
        plan = plan_allocation(vehicles=self._snapshot.vehicles, mission=self._snapshot.mission)
        vehicles = apply_allocation_to_vehicles(
            vehicles=self._snapshot.vehicles,
            assignments=plan.assignments,
            mission=self._snapshot.mission,
        )
        self._snapshot = refresh_allocation_snapshot(
            snapshot=self._snapshot,
            vehicles=vehicles,
            assignments=plan.assignments,
        )
        self._append_proactive_recommendations(trigger="battery_rotation_after_allocation")
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="decision",
            summary="approved optimized allocation from GCS",
            model=plan,
        )
        record_calculation(self._blackbox, self._snapshot, "optimized_allocation_approval")
        return plan

    def tune_vehicle(
        self,
        vehicle_id: VehicleId,
        health: HealthState,
        status: VehicleStatus,
    ) -> DashboardState:
        vehicle_ids = {vehicle.id for vehicle in self._snapshot.vehicles}
        if vehicle_id not in vehicle_ids:
            raise UnknownTargetError(target=vehicle_id)
        self._snapshot = tune_vehicle_snapshot(
            snapshot=self._snapshot,
            vehicle_id=vehicle_id,
            health=health,
            status=status,
        )
        self._append_proactive_recommendations(trigger="battery_rotation_after_tune")
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="event",
            summary=f"vehicle parameters tuned for {vehicle_id}",
            model=self._snapshot,
        )
        record_calculation(self._blackbox, self._snapshot, "vehicle_parameter_tune")
        return self._snapshot

    def inject_event(self, event: EventRequest) -> DashboardState:
        self._ensure_target_exists(event=event)
        card = build_recommendation(snapshot=self._snapshot, event=event)
        self._snapshot = apply_event_to_snapshot(
            snapshot=self._snapshot,
            event=event,
            recommendation=card,
        )
        self._append_proactive_recommendations(trigger=f"battery_rotation_after_{event.event_type}")
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
        record_calculation(self._blackbox, self._snapshot, f"event_{event.event_type.value}")
        return self._snapshot

    def respond(self, event: EventRequest) -> RecommendationCard:
        self._ensure_target_exists(event=event)
        return build_recommendation(snapshot=self._snapshot, event=event)

    def decide(self, request: DecisionRequest) -> DashboardState:
        self._snapshot = decide_recommendation(snapshot=self._snapshot, request=request)
        self._append_proactive_recommendations(trigger="battery_rotation_after_decision")
        resolved_card = find_recommendation(
            snapshot=self._snapshot,
            recommendation_id=request.recommendation_id,
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="decision",
            summary=f"{request.action.value} {request.recommendation_id}",
            model=request,
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="recommendation",
            summary=f"{resolved_card.status.value} {resolved_card.title}",
            model=resolved_card,
        )
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="outcome",
            summary="metrics recomputed after human gate",
            model=self._snapshot.metrics,
        )
        record_calculation(self._blackbox, self._snapshot, f"decision_{request.action.value}")
        return self._snapshot

    def metrics(self) -> MetricSnapshot:
        return self._snapshot.metrics

    def advance_time(self, steps: int) -> DashboardState:
        self._snapshot = advance_time_snapshot(snapshot=self._snapshot, steps=steps)
        self._append_proactive_recommendations(trigger="battery_rotation_after_time_advance")
        self._blackbox.record_model(
            scenario_time=self._snapshot.scenario_time,
            kind="mission",
            summary=f"mission advanced {steps} step(s)",
            model=self._snapshot,
        )
        record_calculation(self._blackbox, self._snapshot, "time_advance")
        return self._snapshot

    def replay(self) -> ReplayResponse:
        return ReplayResponse(entries=self._blackbox.entries())

    def _append_proactive_recommendations(self, trigger: str) -> None:
        existing_ids = {card.id for card in self._snapshot.recommendations}
        self._snapshot = add_battery_rotation_recommendation(snapshot=self._snapshot)
        new_cards = tuple(
            card for card in self._snapshot.recommendations if card.id not in existing_ids
        )
        for card in new_cards:
            self._blackbox.record_model(
                scenario_time=self._snapshot.scenario_time,
                kind="recommendation",
                summary=card.title,
                model=card,
            )
        if len(new_cards) > 0:
            record_calculation(self._blackbox, self._snapshot, trigger)

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

        msg = f"unsupported event type: {event.event_type}"
        raise ValueError(msg)


def runtime_error_to_status(error: Exception) -> int:
    if isinstance(error, DeploymentError):
        return 422
    if isinstance(error, UnknownTargetError):
        return 404
    if isinstance(error, (RecommendationNotFoundError, ManualActionError)):
        return 400
    raise error
