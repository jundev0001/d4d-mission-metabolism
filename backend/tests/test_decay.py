from d4d_mission.capability import effective_capability
from d4d_mission.catalog import vehicle_type_profile
from d4d_mission.decay import horizon_capability, project_vehicle
from d4d_mission.metabolism import evaluate_metrics
from d4d_mission.models import (
    Assignment,
    CapabilityDemand,
    HealthState,
    Mission,
    MissionConstraints,
    Point,
    Vehicle,
)
from d4d_mission.scenario import create_initial_snapshot
from d4d_mission.types import (
    CAPABILITY_NAMES,
    CapabilityName,
    MissionType,
    VehicleStatus,
    VehicleType,
)


def _vehicle(vehicle_id: str, vehicle_type: VehicleType, battery: float) -> Vehicle:
    return Vehicle(
        id=vehicle_id,
        type=vehicle_type,
        label=vehicle_id,
        area="GCS",
        role=CapabilityName.VISUAL_RECON,
        position=Point(x=50, y=80),
        velocity=Point(x=0, y=0),
        health=HealthState(battery=battery, comm=0.9, nav=0.9, sensor=0.9, health=0.95),
        capabilities=vehicle_type_profile(vehicle_type).capabilities,
        status=VehicleStatus.STANDBY,
    )


def _mission(threat: float) -> Mission:
    return Mission(
        id="m",
        mission_type=MissionType.AREA_RECON,
        objective="objective",
        areas=("Z",),
        requirements={
            "Z": CapabilityDemand(
                visual_recon=1.0,
                relay=0.0,
                overwatch=0.0,
                gps_denied_nav=0.0,
                reserve=0.0,
            ),
        },
        constraints=MissionConstraints(),
        area_threats={"Z": threat},
        area_priorities={"Z": 1.0},
        area_centers={"Z": Point(x=50, y=40)},
        area_mission_types={"Z": MissionType.AREA_RECON},
    )


def test_short_endurance_drains_battery_faster() -> None:
    mission = _mission(threat=0.0)
    micro = _vehicle("micro", VehicleType.MICRO_SCOUT_UAV, battery=0.7)
    rover = _vehicle("rover", VehicleType.SENSOR_ROVER, battery=0.7)

    micro_projected = project_vehicle(micro, mission, "Z", steps=3)
    rover_projected = project_vehicle(rover, mission, "Z", steps=3)

    assert micro_projected.health.battery < rover_projected.health.battery


def test_horizon_capability_is_never_above_instant() -> None:
    mission = _mission(threat=0.4)
    vehicle = _vehicle("quad", VehicleType.QUAD_RECON_UAV, battery=0.8)

    horizon = horizon_capability(vehicle, mission, "Z", horizon=3)
    instant = effective_capability(vehicle)

    for capability in CAPABILITY_NAMES:
        assert horizon.value_for(capability) <= instant.value_for(capability) + 1e-9


def test_ew_hardened_type_holds_comm_under_threat() -> None:
    mission = _mission(threat=0.8)
    relay = _vehicle("relay", VehicleType.RELAY_UAV, battery=0.9)
    micro = _vehicle("micro", VehicleType.MICRO_SCOUT_UAV, battery=0.9)

    relay_loss = relay.health.comm - project_vehicle(relay, mission, "Z", steps=3).health.comm
    micro_loss = micro.health.comm - project_vehicle(micro, mission, "Z", steps=3).health.comm

    assert relay_loss < micro_loss


def test_horizon_zero_reduces_to_instant() -> None:
    mission = _mission(threat=0.6)
    vehicle = _vehicle("quad", VehicleType.QUAD_RECON_UAV, battery=0.8)

    horizon = horizon_capability(vehicle, mission, "Z", horizon=0)
    instant = effective_capability(vehicle)

    for capability in CAPABILITY_NAMES:
        assert horizon.value_for(capability) == instant.value_for(capability)


def test_metabolism_collapse_uses_horizon_decay() -> None:
    mission = _mission(threat=1.0)
    vehicle = _vehicle("micro", VehicleType.MICRO_SCOUT_UAV, battery=0.45)
    snapshot = create_initial_snapshot(seed=3).model_copy(
        update={
            "mission": mission,
            "vehicles": (vehicle,),
            "assignments": (
                Assignment(
                    vehicle_id=vehicle.id,
                    area="Z",
                    role=CapabilityName.VISUAL_RECON,
                    weight=1.0,
                ),
            ),
            "events": (),
            "recommendations": (),
        },
    )

    instant = evaluate_metrics(snapshot=snapshot, pending_cards=0, horizon=0)
    projected = evaluate_metrics(snapshot=snapshot, pending_cards=0, horizon=3)

    assert projected.strain > instant.strain
    assert projected.collapse_probability > instant.collapse_probability
