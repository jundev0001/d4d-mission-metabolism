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
        EventType.DATA_STALE: _data_stale_card,
        EventType.TARGET_DETECTED: _target_detected_card,
        EventType.MOBILITY_BLOCKED: _mobility_blocked_card,
        EventType.WEATHER_DEGRADED: _weather_degraded_card,
        EventType.COLLISION_RISK: _collision_risk_card,
        EventType.SENSOR_CONFIDENCE_DROP: _sensor_confidence_drop_card,
        EventType.ASSET_ADDED: _asset_added_card,
        EventType.RESERVE_DEPLETED: _reserve_depleted_card,
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


def _data_stale_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    scout = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.VISUAL_RECON,
        fallback="UxV-01",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} information stale",
        causes=("data_stale", "recon_gap", "capability_deficit"),
        event=event,
        actions=(
            card_action(
                "system",
                MicroActionType.MARK_AREA_STALE,
                event.target,
                "refresh cell value",
            ),
            card_action(scout, MicroActionType.REROUTE, event.target, "revisit stale grid cells"),
            card_action(
                scout,
                MicroActionType.SYNC_DATA,
                event.target,
                "publish refreshed map data",
            ),
        ),
    )


def _target_detected_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    overwatch = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.OVERWATCH,
        fallback="UxV-03",
    )
    scout = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.VISUAL_RECON,
        fallback="UxV-01",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} target handoff",
        causes=("target_detected", "overwatch_gap", "human_gate"),
        event=event,
        actions=(
            card_action(overwatch, MicroActionType.HANDOFF_TARGET, event.target, "hold contact"),
            card_action(scout, MicroActionType.REASSIGN_ROLE, event.target, "confirm detection"),
            card_action(
                "system",
                MicroActionType.REQUEST_HUMAN_CONFIRM,
                event.target,
                "gate target update",
            ),
        ),
    )


def _mobility_blocked_card(
    card_id: str,
    _snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    return make_card(
        card_id=card_id,
        title=f"{event.target} mobility blocked",
        causes=("mobility_blocked", "route_conflict"),
        event=event,
        actions=(
            card_action(event.target, MicroActionType.REROUTE, None, "avoid blocked terrain"),
            card_action(event.target, MicroActionType.SYNC_DATA, None, "share mobility obstacle"),
        ),
    )


def _weather_degraded_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    scout = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.VISUAL_RECON,
        fallback="UxV-01",
    )
    reserve = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.RESERVE,
        fallback="UxV-06",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} weather degradation",
        causes=("weather_degraded", "sensor_confidence", "route_conflict"),
        event=event,
        actions=(
            card_action(
                scout,
                MicroActionType.SWITCH_SENSOR_MODE,
                event.target,
                "use robust scan mode",
            ),
            card_action(scout, MicroActionType.REROUTE, event.target, "avoid exposed route"),
            card_action(
                reserve,
                MicroActionType.LAUNCH_RESERVE,
                event.target,
                "add recovery margin",
            ),
        ),
    )


def _collision_risk_card(
    card_id: str,
    _snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    return make_card(
        card_id=card_id,
        title=f"{event.target} path conflict",
        causes=("collision_risk", "route_conflict"),
        event=event,
        actions=(
            card_action(
                event.target,
                MicroActionType.DECONFLICT_PATHS,
                None,
                "separate route timing",
            ),
            card_action(event.target, MicroActionType.HOLD, None, "hold until path is clear"),
        ),
    )


def _sensor_confidence_drop_card(
    card_id: str,
    snapshot: DashboardState,
    event: EventRequest,
) -> RecommendationCard:
    backup = best_vehicle_for(
        snapshot=snapshot,
        capability=CapabilityName.VISUAL_RECON,
        fallback="UxV-01",
    )
    return make_card(
        card_id=card_id,
        title=f"{event.target} sensor confidence drop",
        causes=("sensor_confidence_drop", "recon_gap"),
        event=event,
        actions=(
            card_action(event.target, MicroActionType.SWITCH_SENSOR_MODE, None, "raise confidence"),
            card_action(backup, MicroActionType.HANDOFF_TARGET, None, "cross-check observation"),
            card_action(event.target, MicroActionType.SYNC_DATA, None, "sync low-confidence mark"),
        ),
    )


def _asset_added_card(
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
        title=f"{event.target} asset added",
        causes=("asset_added", "reserve_activation"),
        event=event,
        actions=(
            card_action(
                reserve,
                MicroActionType.LAUNCH_RESERVE,
                event.target,
                "bring new asset online",
            ),
            card_action(reserve, MicroActionType.REASSIGN_ROLE, event.target, "fit current demand"),
            card_action(
                "system",
                MicroActionType.SYNC_DATA,
                event.target,
                "broadcast new capability",
            ),
        ),
    )


def _reserve_depleted_card(
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
        title=f"{event.target} reserve depleted",
        causes=("reserve_depleted", "capability_deficit", "human_gate"),
        event=event,
        actions=(
            card_action(
                reserve,
                MicroActionType.REDISTRIBUTE_COVERAGE,
                event.target,
                "protect reserve",
            ),
            card_action(
                "system",
                MicroActionType.DOWNGRADE_OBJECTIVE,
                event.target,
                "trim low-priority cells",
            ),
            card_action(
                "system",
                MicroActionType.REQUEST_HUMAN_CONFIRM,
                event.target,
                "approve scope change",
            ),
        ),
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
