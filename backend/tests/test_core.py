from d4d_mission.allocator import apply_allocation_to_vehicles, plan_allocation
from d4d_mission.battery_rotation import add_battery_rotation_recommendation
from d4d_mission.capability import compute_capability_report
from d4d_mission.catalog import mission_templates, vehicle_type_profiles
from d4d_mission.immune import decide_recommendation
from d4d_mission.immune_cards import build_recommendation
from d4d_mission.metabolism import evaluate_metrics, relay_redundancy
from d4d_mission.models import DashboardState, DecisionRequest, EventRequest
from d4d_mission.scenario import apply_event_to_snapshot, create_initial_snapshot
from d4d_mission.types import (
    DEPLOYABLE_VEHICLE_TYPES,
    MISSION_TYPES,
    DecisionAction,
    EventType,
    MicroActionType,
)


def _allocated_snapshot(seed: int) -> DashboardState:
    snapshot = create_initial_snapshot(seed=seed)
    plan = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    vehicles = apply_allocation_to_vehicles(snapshot.vehicles, plan.assignments)
    return snapshot.model_copy(update={"vehicles": vehicles, "assignments": plan.assignments})


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
    assert snapshot.assignments == ()
    assert {vehicle.area for vehicle in snapshot.vehicles} == {"GCS"}


def test_capability_availability_decreases_when_health_degrades() -> None:
    snapshot = _allocated_snapshot(seed=7)
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
    staged = create_initial_snapshot(seed=11)
    assert staged.capability_report.deficit_score == 1

    snapshot = _allocated_snapshot(seed=11)
    report = compute_capability_report(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )

    assert report.overall_mcc <= 1
    assert report.area_reports["B"].coverage["relay"] <= 1
    assert report.overall_mcc >= snapshot.mission.constraints.target_mcc


def test_relay_redundancy_penalizes_ew_pressure_outside_b_area() -> None:
    snapshot = _allocated_snapshot(seed=11)
    initial = relay_redundancy(snapshot)
    mission = snapshot.mission.model_copy(update={"area_threats": {"A": 0.08, "B": 0.12, "C": 1.0}})
    stressed = snapshot.model_copy(update={"mission": mission})

    assert relay_redundancy(stressed) < initial


def test_event_recommendation_and_approval_recover_collapse_and_debt() -> None:
    snapshot = _allocated_snapshot(seed=13)
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

    assert "battery_drop" in card.causes
    assert "adaptive_reallocation" in card.causes
    assert len(card.actions) >= 2
    assert any(action.action == MicroActionType.RETURN for action in card.actions)
    assert card.expected_effect.operator_actions_delta < 0


def test_tactical_immune_builds_cards_for_recommended_events() -> None:
    snapshot = create_initial_snapshot(seed=19)
    cases = {
        EventType.DATA_STALE: ("B", MicroActionType.MARK_AREA_STALE),
        EventType.TARGET_DETECTED: ("B", MicroActionType.HANDOFF_TARGET),
        EventType.GPS_DROP: ("UxV-05", MicroActionType.LAUNCH_RESERVE),
        EventType.SENSOR_FAIL: ("UxV-05", MicroActionType.REPLACE),
        EventType.WEATHER_DEGRADED: ("C", MicroActionType.SWITCH_SENSOR_MODE),
        EventType.RESERVE_DEPLETED: ("B", MicroActionType.DOWNGRADE_OBJECTIVE),
    }

    for event_type, (target, expected_action) in cases.items():
        card = build_recommendation(
            snapshot=snapshot,
            event=EventRequest(event_type=event_type, target=target, severity=0.7),
        )

        assert any(action.action == expected_action for action in card.actions)


def test_adaptive_response_planner_adds_direct_actions_for_all_reallocation_events() -> None:
    snapshot = _allocated_snapshot(seed=19)
    cases = {
        EventType.GPS_DROP: ("UxV-05", {MicroActionType.HOLD}),
        EventType.SENSOR_FAIL: ("UxV-05", {MicroActionType.SWITCH_SENSOR_MODE}),
        EventType.NO_GO: ("B", {MicroActionType.REQUEST_HUMAN_CONFIRM}),
        EventType.PRIORITY_SHIFT: (
            "B",
            {MicroActionType.LAUNCH_RESERVE, MicroActionType.REASSIGN_ROLE},
        ),
    }

    for event_type, (target, expected_actions) in cases.items():
        card = build_recommendation(
            snapshot=snapshot,
            event=EventRequest(event_type=event_type, target=target, severity=0.7),
        )

        assert any(action.action in expected_actions for action in card.actions)


def test_proactive_battery_rotation_returns_and_replaces_projected_low_asset() -> None:
    snapshot = _allocated_snapshot(seed=11)
    target_id = snapshot.assignments[0].vehicle_id
    vehicles = tuple(
        vehicle.model_copy(update={"health": vehicle.health.model_copy(update={"battery": 0.28})})
        if vehicle.id == target_id
        else vehicle
        for vehicle in snapshot.vehicles
    )
    staged = snapshot.model_copy(update={"vehicles": vehicles})

    updated = add_battery_rotation_recommendation(snapshot=staged)

    card = updated.recommendations[0]
    assert "predicted_battery_drop" in card.causes
    assert any(
        action.vehicle_id == target_id and action.action == MicroActionType.RETURN
        for action in card.actions
    )
    assert any(action.action == MicroActionType.REPLACE for action in card.actions)

    deduped = add_battery_rotation_recommendation(snapshot=updated)

    assert len(deduped.recommendations) == len(updated.recommendations)


def test_proactive_battery_rotation_avoids_low_battery_reserve() -> None:
    snapshot = _allocated_snapshot(seed=11)
    target_id = snapshot.assignments[0].vehicle_id
    vehicles = tuple(
        vehicle.model_copy(update={"health": vehicle.health.model_copy(update={"battery": 0.28})})
        if vehicle.id == target_id
        else vehicle
        for vehicle in snapshot.vehicles
    )

    updated = add_battery_rotation_recommendation(
        snapshot=snapshot.model_copy(update={"vehicles": vehicles}),
    )

    card = updated.recommendations[0]
    replacement = next(
        action for action in card.actions if action.action == MicroActionType.REPLACE
    )
    assert replacement.vehicle_id != "UxV-02"


def test_return_and_hold_remove_assignments_from_mission_supply() -> None:
    snapshot = _allocated_snapshot(seed=11)
    assigned = snapshot.assignments[0]
    event = EventRequest(
        event_type=EventType.BATTERY_DROP,
        target=assigned.vehicle_id,
        severity=0.9,
    )
    card = build_recommendation(snapshot=snapshot, event=event)
    stressed = apply_event_to_snapshot(snapshot=snapshot, event=event, recommendation=card)

    approved = decide_recommendation(
        snapshot=stressed,
        request=DecisionRequest(recommendation_id=card.id, action=DecisionAction.APPROVE),
    )

    returned = next(vehicle for vehicle in approved.vehicles if vehicle.id == assigned.vehicle_id)
    assert returned.status == "returning"
    assert all(assignment.vehicle_id != assigned.vehicle_id for assignment in approved.assignments)


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
