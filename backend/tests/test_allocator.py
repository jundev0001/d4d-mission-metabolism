from d4d_mission.allocator import apply_allocation_to_vehicles, plan_allocation
from d4d_mission.capability import compute_capability_report
from d4d_mission.models import Assignment, CapabilityDemand, DashboardState, Point, Vehicle
from d4d_mission.scenario import create_initial_snapshot
from d4d_mission.types import VehicleStatus

ZERO_DEMAND = CapabilityDemand(
    visual_recon=0,
    relay=0,
    overwatch=0,
    gps_denied_nav=0,
    reserve=0,
)


def _snapshot_with_lost(snapshot: DashboardState, vehicle_id: str) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(update={"status": VehicleStatus.LOST})
        if vehicle.id == vehicle_id
        else vehicle
        for vehicle in snapshot.vehicles
    )


def test_initial_scenario_stages_all_assets_at_gcs() -> None:
    snapshot = create_initial_snapshot(seed=11)

    assert snapshot.assignments == ()
    assert {vehicle.area for vehicle in snapshot.vehicles} == {"GCS"}
    assert {vehicle.status for vehicle in snapshot.vehicles} == {VehicleStatus.STANDBY}
    assert all(vehicle.position.x > 89 for vehicle in snapshot.vehicles)
    assert all(vehicle.position.y <= 86 for vehicle in snapshot.vehicles)


def test_allocation_reaches_target_mcc_and_keeps_reserve_at_gcs() -> None:
    snapshot = create_initial_snapshot(seed=11)

    plan = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    vehicles = apply_allocation_to_vehicles(snapshot.vehicles, plan.assignments)
    report = compute_capability_report(
        vehicles=vehicles,
        mission=snapshot.mission,
        assignments=plan.assignments,
    )

    assert report.overall_mcc >= snapshot.mission.constraints.target_mcc
    assert len(plan.assignments) < len(snapshot.vehicles)
    assert any(vehicle.area == "GCS" for vehicle in vehicles)


def test_allocation_assigns_each_deployed_vehicle_at_most_once() -> None:
    snapshot = create_initial_snapshot(seed=11)
    vehicles = _snapshot_with_lost(snapshot, "UxV-01")

    plan = plan_allocation(vehicles=vehicles, mission=snapshot.mission)

    assigned_ids = [assignment.vehicle_id for assignment in plan.assignments]
    expected = {vehicle.id for vehicle in vehicles if vehicle.status != VehicleStatus.LOST}
    assert "UxV-01" not in assigned_ids
    assert set(assigned_ids).issubset(expected)
    assert len(assigned_ids) == len(set(assigned_ids))


def test_allocation_sends_relay_strength_to_relay_demand() -> None:
    snapshot = create_initial_snapshot(seed=11)

    plan = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)

    relay_assignment = next(a for a in plan.assignments if a.vehicle_id == "UxV-04")
    assert relay_assignment.area == "B"


def test_allocation_explanations_reference_real_assignments() -> None:
    snapshot = create_initial_snapshot(seed=11)

    plan = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)

    assert len(plan.explanations) > 0
    assigned_ids = {assignment.vehicle_id for assignment in plan.assignments}
    for text in plan.explanations:
        if "remain at GCS reserve" in text:
            continue
        assert text.split(" ")[0] in assigned_ids


def test_allocation_moves_assigned_assets_and_leaves_surplus_on_standby() -> None:
    snapshot = create_initial_snapshot(seed=11)

    plan = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    vehicles = apply_allocation_to_vehicles(snapshot.vehicles, plan.assignments)

    assigned_ids = {assignment.vehicle_id for assignment in plan.assignments}
    for vehicle in vehicles:
        if vehicle.id in assigned_ids:
            assert vehicle.area in snapshot.mission.areas
            assert vehicle.status == VehicleStatus.ACTIVE
        else:
            assert vehicle.area == "GCS"
            assert vehicle.status == VehicleStatus.STANDBY
            assert vehicle.position.x > 89
            assert vehicle.position.y <= 86


def test_allocation_uses_near_healthy_asset_before_far_low_battery_asset() -> None:
    snapshot = create_initial_snapshot(seed=11)
    mission = snapshot.mission.model_copy(
        update={
            "requirements": {
                "A": ZERO_DEMAND,
                "B": ZERO_DEMAND.model_copy(update={"visual_recon": 0.45}),
                "C": ZERO_DEMAND,
            },
            "area_priorities": {"A": 0.1, "B": 1.0, "C": 0.1},
            "area_threats": {"A": 0, "B": 0, "C": 0},
        },
    )
    vehicles = tuple(
        _patch_vehicle_for_battery_test(vehicle) if vehicle.id in {"UxV-01", "UxV-02"} else vehicle
        for vehicle in snapshot.vehicles
    )

    plan = plan_allocation(vehicles=vehicles, mission=mission)

    assert [assignment.vehicle_id for assignment in plan.assignments] == ["UxV-02"]
    assert plan.assignments[0].area == "B"


def test_allocation_penalizes_no_go_area() -> None:
    snapshot = create_initial_snapshot(seed=11)

    normal = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    no_go_mission = snapshot.mission.model_copy(update={"no_go_areas": ("B",)})
    no_go = plan_allocation(vehicles=snapshot.vehicles, mission=no_go_mission)

    assert _assignment_count(normal.assignments, "B") > _assignment_count(no_go.assignments, "B")


def test_replanning_prefers_stable_assignments_when_mission_is_unchanged() -> None:
    snapshot = create_initial_snapshot(seed=11)
    first = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    vehicles = apply_allocation_to_vehicles(snapshot.vehicles, first.assignments)

    second = plan_allocation(vehicles=vehicles, mission=snapshot.mission)

    assert _assignment_map(second.assignments) == _assignment_map(first.assignments)


def test_high_priority_gap_can_pull_assets_from_lower_priority_area() -> None:
    snapshot = create_initial_snapshot(seed=11)
    first = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    vehicles = apply_allocation_to_vehicles(snapshot.vehicles, first.assignments)
    requirements = dict(snapshot.mission.requirements)
    requirements["B"] = requirements["B"].model_copy(
        update={
            "visual_recon": requirements["B"].visual_recon + 1.4,
            "overwatch": requirements["B"].overwatch + 0.8,
        },
    )
    stressed_mission = snapshot.mission.model_copy(
        update={
            "requirements": requirements,
            "area_priorities": {"A": 0.2, "B": 1.0, "C": 0.2},
        },
    )

    stressed = plan_allocation(vehicles=vehicles, mission=stressed_mission)

    assert _assignment_count(stressed.assignments, "B") > _assignment_count(
        first.assignments,
        "B",
    )


def _patch_vehicle_for_battery_test(vehicle: Vehicle) -> Vehicle:
    if vehicle.id == "UxV-01":
        return vehicle.model_copy(
            update={
                "position": Point(x=0, y=0),
                "health": vehicle.health.model_copy(update={"battery": 0.12}),
            },
        )
    return vehicle.model_copy(
        update={
            "position": Point(x=63, y=39),
            "health": vehicle.health.model_copy(
                update={
                    "battery": 0.95,
                    "comm": 0.95,
                    "nav": 0.95,
                    "sensor": 0.95,
                    "health": 0.95,
                },
            ),
        },
    )


def _assignment_count(assignments: tuple[Assignment, ...], area: str) -> int:
    return sum(1 for assignment in assignments if assignment.area == area)


def _assignment_map(assignments: tuple[Assignment, ...]) -> dict[str, tuple[str, str]]:
    return {
        assignment.vehicle_id: (assignment.area, assignment.role.value)
        for assignment in assignments
    }
