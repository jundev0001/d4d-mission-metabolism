from __future__ import annotations

from collections.abc import Callable

from d4d_mission.immune_card_helpers import best_vehicle_for, card_action, make_card
from d4d_mission.models import (
    DashboardState,
    EventRequest,
    RecommendationCard,
)
from d4d_mission.types import CapabilityName, EventType, MicroActionType

type CardBuilder = Callable[[str, DashboardState, EventRequest], RecommendationCard]


def build_recommendation(snapshot: DashboardState, event: EventRequest) -> RecommendationCard:
    card_id = f"rec-{len(snapshot.recommendations) + len(snapshot.events) + 1:03d}"
    builders: dict[EventType, CardBuilder] = {
        EventType.COMM_JAM: _comm_jam_card,
        EventType.BATTERY_DROP: _battery_card,
        EventType.COMM_DEGRADED: _comm_degraded_card,
        EventType.GPS_DROP: _gps_drop_card,
        EventType.SENSOR_FAIL: _sensor_fail_card,
        EventType.VEHICLE_LOST: _vehicle_lost_card,
        EventType.ALERT_FLOOD: _alert_flood_card,
        EventType.NO_GO: _no_go_card,
        EventType.PRIORITY_SHIFT: _no_go_card,
    }
    return builders[event.event_type](card_id, snapshot, event)


def _comm_jam_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    relay = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RELAY,
        fallback="UxV-04",
    )
    reserve = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RESERVE,
        fallback="UxV-06",
    )
    return make_card(
        card_id=card_id,
        title="B area mission instability",
        causes=("comm_jam", "relay_redundancy", "capability_deficit"),
        event=event,
        actions=(
            card_action(relay, MicroActionType.REPOSITION_RELAY, "B", "move relay to shadow edge"),
            card_action(reserve, MicroActionType.REPLACE, "B", "activate reserve before MCC drop"),
            card_action(
                "UxV-03",
                MicroActionType.LOW_BANDWIDTH,
                "B",
                "reduce degraded scout load",
            ),
        ),
    )


def _battery_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    reserve = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RESERVE,
        fallback="UxV-06",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} below return threshold",
        causes=("battery_drop", "capability_deficit", "return_threshold"),
        event=event,
        actions=(
            card_action(
                event.target,
                MicroActionType.RETURN,
                None,
                "preserve asset before exhaustion",
            ),
            card_action(reserve, MicroActionType.REPLACE, "B", "fill short-recon deficit"),
        ),
    )


def _comm_degraded_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    relay = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RELAY,
        fallback="UxV-04",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} link degraded",
        causes=("comm_degraded", "operator_load", "relay_gap"),
        event=event,
        actions=(
            card_action(relay, MicroActionType.REPOSITION_RELAY, "B", "restore link margin"),
            card_action(
                event.target,
                MicroActionType.LOW_BANDWIDTH,
                "B",
                "switch to packet mode",
            ),
        ),
    )


def _gps_drop_card(
    card_id: str,
    _snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    return make_card(
        card_id=card_id,
        title=f"{event.target} GPS-denied fallback",
        causes=("gps_drop", "navigation_uncertainty"),
        event=event,
        actions=(card_action(event.target, MicroActionType.HOLD, None, "hold low-speed mode"),),
    )


def _sensor_fail_card(
    card_id: str,
    _snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    return make_card(
        card_id=card_id,
        title=f"{event.target} sensor payload failed",
        causes=("sensor_fail", "recon_gap"),
        event=event,
        actions=(
            card_action(
                event.target,
                MicroActionType.REPOSITION_RELAY,
                "B",
                "convert scout into relay contribution",
            ),
        ),
    )


def _vehicle_lost_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    reserve = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RESERVE,
        fallback="UxV-06",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} capability lost",
        causes=("vehicle_lost", "coverage_gap", "reserve_activation"),
        event=event,
        actions=(
            card_action(
                reserve,
                MicroActionType.REPLACE,
                "B",
                "nearest reserve takes lost coverage",
            ),
            card_action(
                "UxV-04",
                MicroActionType.REDISTRIBUTE_COVERAGE,
                "B",
                "rebalance B relay and overwatch coverage",
            ),
        ),
    )


def _alert_flood_card(
    card_id: str,
    _snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    return make_card(
        card_id=card_id,
        title="Alert flood suppression",
        causes=("alert_flood", "operator_load"),
        event=event,
        actions=(
            card_action(
                "system",
                MicroActionType.SUPPRESS_ALERTS,
                None,
                "merge low-priority alerts into one operator card",
            ),
        ),
    )


def _no_go_card(card_id: str, snapshot: DashboardState, event: EventRequest) -> RecommendationCard:
    reserve = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RESERVE,
        fallback="UxV-06",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} route constraint update",
        causes=("no_go", "priority_shift", "human_gate"),
        event=event,
        actions=(
            card_action(
                reserve,
                MicroActionType.REPLACE,
                "B",
                "hold budget under route limits",
            ),
        ),
    )
