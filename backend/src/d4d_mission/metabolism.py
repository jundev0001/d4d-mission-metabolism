from __future__ import annotations

import math

from d4d_mission.capability import clamp01, compute_capability_report
from d4d_mission.models import DashboardState, MetricSnapshot
from d4d_mission.types import VehicleStatus

SINGLE_POINT_RELAY_THRESHOLD = 0.1


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


def _relay_redundancy(snapshot: DashboardState) -> float:
    report = compute_capability_report(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )
    b_area = report.area_reports.get("B")
    if b_area is None:
        return 0.0
    return clamp01(b_area.coverage["relay"] - 0.85)


def _autonomy_debt(
    snapshot: DashboardState,
    pending_cards: int,
    deficit: float,
    attrition_risk: float,
) -> float:
    single_point = 1.0 if _relay_redundancy(snapshot) < SINGLE_POINT_RELAY_THRESHOLD else 0.0
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
