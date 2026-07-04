from __future__ import annotations

from d4d_mission.capability import compute_capability_report
from d4d_mission.metabolism import evaluate_metrics
from d4d_mission.models import (
    CapabilityReport,
    DashboardState,
    EventRecord,
    EventRequest,
    MetricSnapshot,
    RecommendationCard,
)
from d4d_mission.scenario_events import (
    apply_event_to_mission,
    apply_event_to_vehicle,
    event_summary,
)
from d4d_mission.scenario_seed import default_assignments, default_mission, default_vehicles
from d4d_mission.types import RecommendationStatus


def create_initial_snapshot(seed: int = 42) -> DashboardState:
    mission = default_mission()
    vehicles = default_vehicles(seed=seed)
    assignments = default_assignments()
    report = compute_capability_report(vehicles=vehicles, mission=mission, assignments=assignments)
    snapshot = DashboardState(
        mission=mission,
        vehicles=vehicles,
        assignments=assignments,
        metrics=_placeholder_metrics(report=report),
        capability_report=report,
        recommendations=(),
        events=(),
        scenario_time=0,
        baseline_operator_actions=28,
        assisted_operator_actions=1,
        system_micro_actions=1,
        human_intents=1,
        recovery_actions=0,
    )
    return refresh_snapshot(snapshot=snapshot)


def apply_event_to_snapshot(
    snapshot: DashboardState,
    event: EventRequest,
    recommendation: RecommendationCard,
) -> DashboardState:
    event_record = EventRecord(
        id=f"evt-{len(snapshot.events) + 1:03d}",
        event_type=event.event_type,
        target=event.target,
        severity=event.severity,
        scenario_time=snapshot.scenario_time + 30,
        summary=event_summary(event=event),
    )
    card = recommendation.model_copy(update={"event_id": event_record.id})
    updated = snapshot.model_copy(
        update={
            "mission": apply_event_to_mission(snapshot.mission, event),
            "vehicles": tuple(
                apply_event_to_vehicle(vehicle=vehicle, event=event)
                for vehicle in snapshot.vehicles
            ),
            "recommendations": (card, *snapshot.recommendations),
            "events": (*snapshot.events, event_record),
            "scenario_time": event_record.scenario_time,
            "assisted_operator_actions": snapshot.assisted_operator_actions + 1,
        },
    )
    return refresh_snapshot(snapshot=updated)


def refresh_snapshot(snapshot: DashboardState) -> DashboardState:
    report = compute_capability_report(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )
    pending_cards = sum(
        1 for card in snapshot.recommendations if card.status == RecommendationStatus.PENDING
    )
    updated = snapshot.model_copy(update={"capability_report": report})
    metrics = evaluate_metrics(snapshot=updated, pending_cards=pending_cards)
    return updated.model_copy(update={"metrics": metrics})


def _placeholder_metrics(report: CapabilityReport) -> MetricSnapshot:
    return MetricSnapshot(
        mcc=report.overall_mcc,
        strain=0.0,
        collapse_probability=0.0,
        autonomy_debt=0.0,
        operator_actions=1,
        alert_backlog=0,
        approval_count=0,
        replan_time_seconds=0.0,
        ccr_external=28.0,
        ccr_internal=1.0,
    )
