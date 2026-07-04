from __future__ import annotations

from d4d_mission.capability import compute_capability_report
from d4d_mission.metabolism import evaluate_metrics
from d4d_mission.models import (
    Assignment,
    CapabilityReport,
    DashboardState,
    EventRecord,
    EventRequest,
    MetricSnapshot,
    Mission,
    RecommendationCard,
    Vehicle,
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
        baseline_metrics=_placeholder_metrics(report=report),
        capability_report=report,
        recommendations=(),
        events=(),
        scenario_time=0,
        baseline_operator_actions=28,
        assisted_operator_actions=1,
        system_micro_actions=1,
        human_intents=1,
        recovery_actions=0,
        baseline_mission=mission,
        baseline_vehicles=vehicles,
        baseline_assignments=assignments,
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
    baseline_mission, baseline_vehicles, baseline_assignments = _baseline_projection(snapshot)
    updated = snapshot.model_copy(
        update={
            "mission": apply_event_to_mission(snapshot.mission, event),
            "vehicles": tuple(
                apply_event_to_vehicle(vehicle=vehicle, event=event)
                for vehicle in snapshot.vehicles
            ),
            "baseline_mission": apply_event_to_mission(baseline_mission, event),
            "baseline_vehicles": tuple(
                apply_event_to_vehicle(vehicle=vehicle, event=event)
                for vehicle in baseline_vehicles
            ),
            "baseline_assignments": baseline_assignments,
            "recommendations": (card, *snapshot.recommendations),
            "events": (*snapshot.events, event_record),
            "scenario_time": event_record.scenario_time,
            "baseline_operator_actions": snapshot.baseline_operator_actions
            + _manual_event_action_count(event),
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
    updated_with_metrics = updated.model_copy(update={"metrics": metrics})
    baseline_metrics = _paired_baseline_metrics(snapshot=updated_with_metrics)
    return updated_with_metrics.model_copy(update={"baseline_metrics": baseline_metrics})


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


def _paired_baseline_metrics(snapshot: DashboardState) -> MetricSnapshot:
    baseline_mission, baseline_vehicles, baseline_assignments = _baseline_projection(snapshot)
    report = compute_capability_report(
        vehicles=baseline_vehicles,
        mission=baseline_mission,
        assignments=baseline_assignments,
    )
    baseline_operator_actions = max(1, snapshot.baseline_operator_actions)
    replan_seconds = _baseline_replan_seconds(
        baseline_operator_actions=baseline_operator_actions,
        event_count=len(snapshot.events),
    )
    baseline_snapshot = snapshot.model_copy(
        update={
            "mission": baseline_mission,
            "vehicles": baseline_vehicles,
            "assignments": baseline_assignments,
            "capability_report": report,
            "recommendations": (),
            "assisted_operator_actions": baseline_operator_actions,
            "system_micro_actions": baseline_operator_actions,
            "human_intents": baseline_operator_actions,
            "recovery_actions": 0,
            "metrics": snapshot.metrics.model_copy(update={"replan_time_seconds": replan_seconds}),
        },
    )
    metrics = evaluate_metrics(snapshot=baseline_snapshot, pending_cards=len(snapshot.events))
    return metrics.model_copy(
        update={
            "operator_actions": baseline_operator_actions,
            "alert_backlog": len(snapshot.events),
            "approval_count": 0,
            "replan_time_seconds": round(replan_seconds, 1),
            "ccr_external": 1.0,
            "ccr_internal": 1.0,
        },
    )


def _baseline_projection(
    snapshot: DashboardState,
) -> tuple[Mission, tuple[Vehicle, ...], tuple[Assignment, ...]]:
    return (
        snapshot.baseline_mission or snapshot.mission,
        snapshot.baseline_vehicles or snapshot.vehicles,
        snapshot.baseline_assignments or snapshot.assignments,
    )


def _manual_event_action_count(event: EventRequest) -> int:
    return max(3, round(4 + (event.severity * 5)))


def _baseline_replan_seconds(baseline_operator_actions: int, event_count: int) -> float:
    return (baseline_operator_actions * 4.0) + (event_count * 14.0)
