from d4d_mission.capability import compute_capability_report
from d4d_mission.immune import decide_recommendation
from d4d_mission.immune_cards import build_recommendation
from d4d_mission.metabolism import evaluate_metrics
from d4d_mission.models import DecisionRequest, EventRequest
from d4d_mission.scenario import apply_event_to_snapshot, create_initial_snapshot
from d4d_mission.types import DecisionAction, EventType


def test_capability_availability_decreases_when_health_degrades() -> None:
    snapshot = create_initial_snapshot(seed=7)
    healthy_report = compute_capability_report(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )
    degraded = snapshot.vehicles[0].model_copy(
        update={"health": snapshot.vehicles[0].health.model_copy(update={"battery": 0.12})},
    )

    degraded_report = compute_capability_report(
        vehicles=(degraded, *snapshot.vehicles[1:]),
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )

    assert degraded_report.effective_capabilities[degraded.id].visual_recon < (
        healthy_report.effective_capabilities[degraded.id].visual_recon
    )


def test_mcc_caps_at_one_and_reports_deficits() -> None:
    snapshot = create_initial_snapshot(seed=11)

    report = compute_capability_report(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )

    assert report.overall_mcc <= 1
    assert report.area_reports["B"].coverage["relay"] <= 1
    assert report.area_reports["B"].deficit["relay"] == 0


def test_event_recommendation_and_approval_recover_collapse_and_debt() -> None:
    snapshot = create_initial_snapshot(seed=13)
    initial = evaluate_metrics(snapshot=snapshot, pending_cards=0)
    event = EventRequest(event_type=EventType.COMM_JAM, target="B", severity=0.82)
    card = build_recommendation(snapshot=snapshot, event=event)
    stressed = apply_event_to_snapshot(snapshot=snapshot, event=event, recommendation=card)
    stressed_metrics = evaluate_metrics(snapshot=stressed, pending_cards=1)

    approved = decide_recommendation(
        snapshot=stressed,
        request=DecisionRequest(recommendation_id=card.id, action=DecisionAction.APPROVE),
    )
    recovered = evaluate_metrics(snapshot=approved, pending_cards=0)

    assert stressed_metrics.collapse_probability > initial.collapse_probability
    assert stressed_metrics.autonomy_debt > initial.autonomy_debt
    assert recovered.collapse_probability < stressed_metrics.collapse_probability
    assert recovered.autonomy_debt < stressed_metrics.autonomy_debt


def test_tactical_immune_card_has_explainable_actions_and_kpi_delta() -> None:
    snapshot = create_initial_snapshot(seed=17)
    event = EventRequest(event_type=EventType.BATTERY_DROP, target="UxV-02", severity=0.9)

    card = build_recommendation(snapshot=snapshot, event=event)

    assert card.causes == ("battery_drop", "capability_deficit", "return_threshold")
    assert len(card.actions) >= 2
    assert card.expected_effect.mcc_delta > 0
    assert card.expected_effect.collapse_probability_delta < 0
    assert card.expected_effect.autonomy_debt_delta < 0
