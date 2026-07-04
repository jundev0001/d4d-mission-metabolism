from d4d_mission.allocator import plan_allocation
from d4d_mission.capability import compute_capability_report
from d4d_mission.models import Assignment, DashboardState, Mission, Vehicle
from d4d_mission.scenario import create_initial_snapshot
from d4d_mission.types import VehicleStatus


def _deficit(
    vehicles: tuple[Vehicle, ...],
    mission: Mission,
    assignments: tuple[Assignment, ...],
) -> float:
    return compute_capability_report(
        vehicles=vehicles,
        mission=mission,
        assignments=assignments,
    ).deficit_score


def _round_robin(vehicles: tuple[Vehicle, ...], mission: Mission) -> tuple[Assignment, ...]:
    areas = mission.areas
    return tuple(
        Assignment(
            vehicle_id=vehicle.id,
            area=areas[index % len(areas)],
            role=vehicle.role,
            weight=0.75 if vehicle.synthetic else 1.0,
        )
        for index, vehicle in enumerate(vehicles)
        if vehicle.status != VehicleStatus.LOST
    )


def _snapshot_with_lost(snapshot: DashboardState, vehicle_id: str) -> tuple[Vehicle, ...]:
    return tuple(
        vehicle.model_copy(update={"status": VehicleStatus.LOST})
        if vehicle.id == vehicle_id
        else vehicle
        for vehicle in snapshot.vehicles
    )


def test_allocation_beats_round_robin_on_deficit() -> None:
    snapshot = create_initial_snapshot(seed=11)

    plan = plan_allocation(vehicles=snapshot.vehicles, mission=snapshot.mission)
    baseline = _round_robin(snapshot.vehicles, snapshot.mission)

    assert _deficit(snapshot.vehicles, snapshot.mission, plan.assignments) <= _deficit(
        snapshot.vehicles,
        snapshot.mission,
        baseline,
    )


def test_allocation_assigns_every_non_lost_vehicle_once() -> None:
    snapshot = create_initial_snapshot(seed=11)
    vehicles = _snapshot_with_lost(snapshot, "UxV-01")

    plan = plan_allocation(vehicles=vehicles, mission=snapshot.mission)

    assigned_ids = [assignment.vehicle_id for assignment in plan.assignments]
    expected = {vehicle.id for vehicle in vehicles if vehicle.status != VehicleStatus.LOST}
    assert "UxV-01" not in assigned_ids
    assert set(assigned_ids) == expected
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
        assert text.split(" ")[0] in assigned_ids
