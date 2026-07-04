from d4d_mission.capability import compute_capability_report
from d4d_mission.catalog import mission_templates, vehicle_type_profiles
from d4d_mission.immune import decide_recommendation
from d4d_mission.immune_cards import build_recommendation
from d4d_mission.metabolism import _relay_redundancy, evaluate_metrics
from d4d_mission.models import DecisionRequest, EventRequest
from d4d_mission.scenario import apply_event_to_snapshot, create_initial_snapshot
from d4d_mission.types import (
    DEPLOYABLE_VEHICLE_TYPES,
    MISSION_TYPES,
    DecisionAction,
    EventType,
    MicroActionType,
)


def test_catalog_contains_mission_and_vehicle_type_vectors() -> None:
    missions = mission_templates()
    vehicles = vehicle_type_profiles()

    assert tuple(template.mission_type for template in missions) == MISSION_TYPES
    assert tuple(profile.vehicle_type for profile in vehicles) == DEPLOYABLE_VEHICLE_TYPES
    assert len(missions) == 7
    assert len(vehicles) == 8
    assert all(template.demand.visual_recon >= 0 for template in missions)
    assert all(profile.capabilities.reserve >= 0 for profile in vehicles)


def test_default_scenario_uses_new_catalog_types() -> None:
    snapshot = create_initial_snapshot(seed=5)
    vehicle_types = {vehicle.type for vehicle in snapshot.vehicles if not vehicle.synthetic}

    assert snapshot.mission.mission_type == MISSION_TYPES[0]
    assert vehicle_types.issubset(set(DEPLOYABLE_VEHICLE_TYPES))


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


def test_relay_redundancy_penalizes_ew_pressure_outside_b_area() -> None:
    snapshot = create_initial_snapshot(seed=11)
    initial = _relay_redundancy(snapshot)
    mission = snapshot.mission.model_copy(update={"area_threats": {"A": 0.08, "B": 0.12, "C": 1.0}})
    stressed = snapshot.model_copy(update={"mission": mission})

    assert _relay_redundancy(stressed) < initial


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


def test_tactical_immune_builds_cards_for_recommended_events() -> None:
    snapshot = create_initial_snapshot(seed=19)
    cases = {
        EventType.DATA_STALE: ("B", MicroActionType.MARK_AREA_STALE),
        EventType.TARGET_DETECTED: ("B", MicroActionType.HANDOFF_TARGET),
        EventType.MOBILITY_BLOCKED: ("UxV-05", MicroActionType.REROUTE),
        EventType.WEATHER_DEGRADED: ("C", MicroActionType.SWITCH_SENSOR_MODE),
        EventType.COLLISION_RISK: ("UxV-03", MicroActionType.DECONFLICT_PATHS),
        EventType.SENSOR_CONFIDENCE_DROP: ("UxV-01", MicroActionType.SWITCH_SENSOR_MODE),
        EventType.ASSET_ADDED: ("A", MicroActionType.LAUNCH_RESERVE),
        EventType.RESERVE_DEPLETED: ("B", MicroActionType.DOWNGRADE_OBJECTIVE),
    }

    for event_type, (target, expected_action) in cases.items():
        card = build_recommendation(
            snapshot=snapshot,
            event=EventRequest(event_type=event_type, target=target, severity=0.7),
        )

        assert any(action.action == expected_action for action in card.actions)


def test_new_immune_action_approval_recomputes_metrics() -> None:
    snapshot = create_initial_snapshot(seed=23)
    event = EventRequest(event_type=EventType.TARGET_DETECTED, target="B", severity=0.8)
    card = build_recommendation(snapshot=snapshot, event=event)
    stressed = apply_event_to_snapshot(snapshot=snapshot, event=event, recommendation=card)

    approved = decide_recommendation(
        snapshot=stressed,
        request=DecisionRequest(recommendation_id=card.id, action=DecisionAction.APPROVE),
    )

    assert approved.recommendations[0].status == "approved"
    assert approved.system_micro_actions > stressed.system_micro_actions
    assert approved.metrics.approval_count == 1
