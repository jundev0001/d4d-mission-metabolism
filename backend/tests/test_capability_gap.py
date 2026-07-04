from d4d_mission.capability import compute_capability_report
from d4d_mission.capability_gap import MIN_DEFICIT_RATIO, analyze_capability_gaps, top_gap
from d4d_mission.models import DashboardState
from d4d_mission.scenario import create_initial_snapshot
from d4d_mission.types import CapabilityName, VehicleStatus


def _snapshot_with_lost(*vehicle_ids: str) -> DashboardState:
    snapshot = create_initial_snapshot(seed=13)
    lost = set(vehicle_ids)
    vehicles = tuple(
        vehicle.model_copy(update={"status": VehicleStatus.LOST}) if vehicle.id in lost else vehicle
        for vehicle in snapshot.vehicles
    )
    return snapshot.model_copy(update={"vehicles": vehicles})


def test_gaps_are_ranked_by_priority_and_internally_consistent() -> None:
    snapshot = _snapshot_with_lost("UxV-04", "UxV-05")

    gaps = analyze_capability_gaps(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )

    assert len(gaps) >= 2
    priorities = [gap.priority for gap in gaps]
    assert priorities == sorted(priorities, reverse=True)
    for gap in gaps:
        assert gap.deficit_ratio >= MIN_DEFICIT_RATIO
        assert gap.deficit_absolute >= 0.0
        assert gap.single_point == (gap.contributor_count < 2)


def test_gap_set_and_ratio_match_capability_report() -> None:
    for snapshot in (create_initial_snapshot(seed=11), _snapshot_with_lost("UxV-04", "UxV-05")):
        report = compute_capability_report(
            vehicles=snapshot.vehicles,
            mission=snapshot.mission,
            assignments=snapshot.assignments,
        )
        gaps = analyze_capability_gaps(
            vehicles=snapshot.vehicles,
            mission=snapshot.mission,
            assignments=snapshot.assignments,
        )

        expected = {
            (area, capability)
            for area, coverage in report.area_reports.items()
            for capability, ratio in coverage.deficit.items()
            if ratio >= MIN_DEFICIT_RATIO
        }
        produced = {(gap.area, gap.capability.value) for gap in gaps}
        assert produced == expected
        for gap in gaps:
            assert gap.deficit_ratio == report.area_reports[gap.area].deficit[gap.capability.value]


def test_losing_relay_vehicle_surfaces_b_relay_gap() -> None:
    healthy = create_initial_snapshot(seed=11)
    healthy_gaps = analyze_capability_gaps(
        vehicles=healthy.vehicles,
        mission=healthy.mission,
        assignments=healthy.assignments,
    )
    assert not any(
        gap.area == "B" and gap.capability == CapabilityName.RELAY for gap in healthy_gaps
    )

    degraded = _snapshot_with_lost("UxV-04")
    gaps = analyze_capability_gaps(
        vehicles=degraded.vehicles,
        mission=degraded.mission,
        assignments=degraded.assignments,
    )
    relay_b = [gap for gap in gaps if gap.area == "B" and gap.capability == CapabilityName.RELAY]
    assert len(relay_b) == 1
    assert relay_b[0].deficit_ratio > 0


def test_ew_pressure_increases_gap_priority() -> None:
    base = _snapshot_with_lost("UxV-04")
    base_priority = {
        (gap.area, gap.capability): gap.priority
        for gap in analyze_capability_gaps(
            vehicles=base.vehicles,
            mission=base.mission,
            assignments=base.assignments,
        )
    }

    stressed_mission = base.mission.model_copy(
        update={"area_threats": {**base.mission.area_threats, "B": 0.9}},
    )
    stressed = base.model_copy(update={"mission": stressed_mission})
    stressed_priority = {
        (gap.area, gap.capability): gap.priority
        for gap in analyze_capability_gaps(
            vehicles=stressed.vehicles,
            mission=stressed.mission,
            assignments=stressed.assignments,
        )
    }

    key = ("B", CapabilityName.RELAY)
    assert stressed_priority[key] > base_priority[key]


def test_top_gap_returns_highest_priority_or_none() -> None:
    snapshot = _snapshot_with_lost("UxV-04", "UxV-05")
    gaps = analyze_capability_gaps(
        vehicles=snapshot.vehicles,
        mission=snapshot.mission,
        assignments=snapshot.assignments,
    )

    assert top_gap(gaps) is gaps[0]
    assert top_gap(()) is None
