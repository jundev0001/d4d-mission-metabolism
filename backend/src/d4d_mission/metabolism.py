from __future__ import annotations

import math
from dataclasses import dataclass

from d4d_mission.capability import clamp01, compute_capability_report, effective_capability
from d4d_mission.models import DashboardState, MetricSnapshot, Vehicle
from d4d_mission.types import VehicleStatus

RELAY_CONTRIBUTOR_THRESHOLD = 0.05
RELAY_MARGIN_TARGET = 0.5
MIN_RELAY_CONTRIBUTORS = 2
SINGLE_RELAY_SHARE_THRESHOLD = 0.75


@dataclass(frozen=True, slots=True)
class RelayAreaStatus:
    score: float
    demand: float
    single_point_risk: bool


def evaluate_metrics(snapshot: DashboardState, pending_cards: int) -> MetricSnapshot:
    report = compute_capability_report(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )
    ew_pressure = max(snapshot.mission.area_threats.values(), default=0.0)
    comm_saturation = _average_comm_loss(snapshot)
    attrition_risk = _attrition_risk(snapshot)
    redundancy = _relay_redundancy(snapshot)
    operator_load = clamp01((pending_cards * 0.12) + (len(snapshot.events) * 0.035))
    strain = clamp01(
        (report.deficit_score * 1.15)
        + (ew_pressure * 0.2)
        + (comm_saturation * 0.14)
        + (operator_load * 0.16)
        + (attrition_risk * 0.16)
        - (redundancy * 0.1),
    )
    collapse = _logistic(strain=strain)
    debt = _autonomy_debt(
        snapshot=snapshot,
        pending_cards=pending_cards,
        deficit=report.deficit_score,
        attrition_risk=attrition_risk,
    )
    assisted_actions = max(1, snapshot.assisted_operator_actions)
    human_intents = max(1, snapshot.human_intents)
    return MetricSnapshot(
        mcc=report.overall_mcc,
        strain=round(strain, 3),
        collapse_probability=round(collapse, 3),
        autonomy_debt=round(debt, 1),
        operator_actions=snapshot.assisted_operator_actions,
        alert_backlog=pending_cards,
        approval_count=sum(1 for card in snapshot.recommendations if card.status == "approved"),
        replan_time_seconds=round(snapshot.metrics.replan_time_seconds, 1),
        ccr_external=round(snapshot.baseline_operator_actions / assisted_actions, 2),
        ccr_internal=round(snapshot.system_micro_actions / human_intents, 2),
    )


def _logistic(strain: float) -> float:
    return clamp01(1 / (1 + math.exp(-(-2.0 + (4.8 * strain)))))


def _average_comm_loss(snapshot: DashboardState) -> float:
    active = [vehicle for vehicle in snapshot.vehicles if vehicle.status != VehicleStatus.LOST]
    if len(active) == 0:
        return 1.0
    return clamp01(sum(1 - vehicle.health.comm for vehicle in active) / len(active))


def _attrition_risk(snapshot: DashboardState) -> float:
    risks: list[float] = []
    for vehicle in snapshot.vehicles:
        if vehicle.status == VehicleStatus.LOST:
            risks.append(1.0)
        else:
            risks.append(max(1 - vehicle.health.battery, 1 - vehicle.health.health))
    return clamp01(sum(risks) / len(risks))


def relay_redundancy(snapshot: DashboardState) -> float:
    return _relay_redundancy(snapshot)


def _relay_redundancy(snapshot: DashboardState) -> float:
    area_statuses = _relay_area_statuses(snapshot)
    if len(area_statuses) == 0:
        return 0.0
    total_demand = sum(status.demand for status in area_statuses)
    weighted_average = sum(status.score * status.demand for status in area_statuses) / total_demand
    worst_area = min(status.score for status in area_statuses)
    return clamp01((weighted_average * 0.75) + (worst_area * 0.25))


def _relay_area_statuses(snapshot: DashboardState) -> tuple[RelayAreaStatus, ...]:
    vehicles_by_id = {vehicle.id: vehicle for vehicle in snapshot.vehicles}
    statuses: list[RelayAreaStatus] = []
    for area in snapshot.mission.areas:
        relay_demand = snapshot.mission.requirements[area].relay
        if relay_demand <= 0:
            continue
        contributions = _relay_contributions(
            area=area,
            vehicles_by_id=vehicles_by_id,
            snapshot=snapshot,
        )
        relay_supply = sum(contribution for _, contribution in contributions)
        if relay_supply <= 0:
            statuses.append(RelayAreaStatus(score=0.0, demand=relay_demand, single_point_risk=True))
            continue
        contributor_count = sum(
            1 for _, contribution in contributions if contribution >= RELAY_CONTRIBUTOR_THRESHOLD
        )
        largest_share = max(contribution / relay_supply for _, contribution in contributions)
        relay_ratio = relay_supply / relay_demand
        relay_margin = clamp01((relay_ratio - 1.0) / RELAY_MARGIN_TARGET)
        relay_diversity = clamp01(1.0 - largest_share)
        backup_count_score = clamp01((contributor_count - 1) / 2)
        relay_health = _weighted_relay_health(
            contributions=contributions,
            relay_supply=relay_supply,
        )
        ew_pressure = snapshot.mission.area_threats.get(area, 0.0)
        score = clamp01(
            (relay_margin * 0.4)
            + (relay_diversity * 0.25)
            + (backup_count_score * 0.2)
            + (relay_health * 0.15)
            - (ew_pressure * 0.25),
        )
        statuses.append(
            RelayAreaStatus(
                score=score,
                demand=relay_demand,
                single_point_risk=(
                    relay_ratio < 1.0
                    or contributor_count < MIN_RELAY_CONTRIBUTORS
                    or largest_share > SINGLE_RELAY_SHARE_THRESHOLD
                ),
            ),
        )
    return tuple(statuses)


def _relay_contributions(
    area: str,
    vehicles_by_id: dict[str, Vehicle],
    snapshot: DashboardState,
) -> list[tuple[Vehicle, float]]:
    contributions: list[tuple[Vehicle, float]] = []
    for assignment in snapshot.assignments:
        if assignment.area != area:
            continue
        vehicle = vehicles_by_id.get(assignment.vehicle_id)
        if vehicle is None:
            continue
        relay_supply = effective_capability(vehicle).relay * assignment.weight
        if relay_supply > 0:
            contributions.append((vehicle, relay_supply))
    return contributions


def _weighted_relay_health(
    contributions: list[tuple[Vehicle, float]],
    relay_supply: float,
) -> float:
    weighted_total = 0.0
    for vehicle, contribution in contributions:
        health_score = clamp01(
            (vehicle.health.comm * 0.5)
            + (vehicle.health.battery * 0.25)
            + (vehicle.health.health * 0.25),
        )
        weighted_total += health_score * contribution
    return clamp01(weighted_total / relay_supply)


def _single_point_relay_risk(snapshot: DashboardState) -> float:
    return (
        1.0 if any(status.single_point_risk for status in _relay_area_statuses(snapshot)) else 0.0
    )


def _autonomy_debt(
    snapshot: DashboardState,
    pending_cards: int,
    deficit: float,
    attrition_risk: float,
) -> float:
    single_point = _single_point_relay_risk(snapshot)
    uncertainty = clamp01(attrition_risk + (deficit * 0.5))
    raw = (
        18
        + (pending_cards * 13)
        + (single_point * 18)
        + (uncertainty * snapshot.mission.autonomy_level * 20)
        + (len(snapshot.events) * 3.5)
        + (deficit * 40)
        - (snapshot.recovery_actions * 6)
    )
    return min(100.0, max(0.0, raw))
