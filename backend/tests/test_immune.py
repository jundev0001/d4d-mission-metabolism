from d4d_mission.capability import effective_capability
from d4d_mission.immune import decide_recommendation
from d4d_mission.immune_card_helpers import best_vehicle_for, card_action, make_card
from d4d_mission.immune_cards import build_recommendation
from d4d_mission.models import CapabilityGap, DecisionRequest, EventRequest
from d4d_mission.scenario import apply_event_to_snapshot, create_initial_snapshot
from d4d_mission.types import (
    CAPABILITY_NAMES,
    CapabilityName,
    DecisionAction,
    EventType,
    MicroActionType,
    VehicleStatus,
)


def _gap(ratio: float) -> CapabilityGap:
    return CapabilityGap(
        area="B",
        capability=CapabilityName.RELAY,
        demand=1.0,
        supply=1.0 - ratio,
        deficit_ratio=ratio,
        deficit_absolute=ratio,
        contributor_count=1,
        single_point=True,
        priority=ratio,
    )


def test_card_targets_failed_vehicle_area_not_hardcoded_b() -> None:
    snapshot = create_initial_snapshot(seed=11)
    event = EventRequest(event_type=EventType.BATTERY_DROP, target="UxV-05", severity=0.6)

    card = build_recommendation(snapshot=snapshot, event=event)

    areas = {action.area for action in card.actions if action.area is not None}
    assert "C" in areas
    assert "B" not in areas


def test_best_vehicle_uses_effective_not_raw_capability() -> None:
    snapshot = create_initial_snapshot(seed=11)
    assert best_vehicle_for(snapshot, CapabilityName.RELAY) == "UxV-04"

    crippled = tuple(
        vehicle.model_copy(
            update={"health": vehicle.health.model_copy(update={"battery": 0.01, "comm": 0.01})},
        )
        if vehicle.id == "UxV-04"
        else vehicle
        for vehicle in snapshot.vehicles
    )
    degraded = snapshot.model_copy(update={"vehicles": crippled})

    assert best_vehicle_for(degraded, CapabilityName.RELAY) != "UxV-04"


def test_card_excludes_failed_vehicle_from_actions() -> None:
    snapshot = create_initial_snapshot(seed=11)
    event = EventRequest(event_type=EventType.VEHICLE_LOST, target="UxV-04", severity=0.8)

    card = build_recommendation(snapshot=snapshot, event=event)

    assert all(action.vehicle_id != "UxV-04" for action in card.actions)


def test_multi_action_card_does_not_double_book_a_vehicle() -> None:
    snapshot = create_initial_snapshot(seed=11)
    event = EventRequest(event_type=EventType.COMM_JAM, target="A", severity=0.5)

    card = build_recommendation(snapshot=snapshot, event=event)

    vehicle_ids = [action.vehicle_id for action in card.actions]
    assert len(vehicle_ids) == len(set(vehicle_ids))


def test_expected_effect_scales_with_gap_severity() -> None:
    event = EventRequest(event_type=EventType.COMM_JAM, target="B", severity=0.2)
    actions = (card_action("UxV-01", MicroActionType.HOLD, "B", "hold"),)

    small = make_card("rec-a", "title", ("cause",), event, actions, gap=_gap(0.1))
    big = make_card("rec-b", "title", ("cause",), event, actions, gap=_gap(0.9))

    assert big.expected_effect.mcc_delta > small.expected_effect.mcc_delta
    assert big.expected_effect.collapse_probability_delta < (
        small.expected_effect.collapse_probability_delta
    )
    assert big.expected_effect.autonomy_debt_delta < small.expected_effect.autonomy_debt_delta


def test_replacement_role_and_area_follow_target_area() -> None:
    snapshot = create_initial_snapshot(seed=11)
    event = EventRequest(event_type=EventType.VEHICLE_LOST, target="UxV-05", severity=0.8)
    card = build_recommendation(snapshot=snapshot, event=event)
    reserve_id = next(
        action.vehicle_id
        for action in card.actions
        if action.action == MicroActionType.REPLACE
    )

    stressed = apply_event_to_snapshot(snapshot=snapshot, event=event, recommendation=card)
    updated = decide_recommendation(
        snapshot=stressed,
        request=DecisionRequest(recommendation_id=card.id, action=DecisionAction.APPROVE),
    )
    reserve = next(vehicle for vehicle in updated.vehicles if vehicle.id == reserve_id)
    dominant = max(CAPABILITY_NAMES, key=effective_capability(reserve).value_for)

    assert reserve.area == "C"
    assert reserve.status == VehicleStatus.ACTIVE
    assert reserve.role == dominant
