from __future__ import annotations

from d4d_mission.catalog import mission_template, vehicle_type_profile
from d4d_mission.models import (
    Assignment,
    CapabilityDemand,
    CapabilityVector,
    HealthState,
    Mission,
    MissionConstraints,
    Point,
    Vehicle,
)
from d4d_mission.types import CapabilityName, MissionType, VehicleStatus, VehicleType

GCS_AREA = "GCS"
GCS_POINT = Point(x=94.7, y=58)


def default_mission() -> Mission:
    template = mission_template(MissionType.AREA_RECON)
    requirements = {
        "A": CapabilityDemand(
            visual_recon=1.35,
            relay=0.45,
            overwatch=0.65,
            gps_denied_nav=0.35,
            reserve=0.25,
        ),
        "B": CapabilityDemand(
            visual_recon=1.2,
            relay=1.0,
            overwatch=0.8,
            gps_denied_nav=0.45,
            reserve=0.35,
        ),
        "C": CapabilityDemand(
            visual_recon=1.25,
            relay=0.5,
            overwatch=0.65,
            gps_denied_nav=0.4,
            reserve=0.25,
        ),
    }
    return Mission(
        id="mission-seoul-isr",
        mission_type=template.mission_type,
        objective=(
            "Stage all UxVs at GCS, approve optimized A/B/C ISR task forces, "
            "and preserve reserve rotation"
        ),
        areas=("A", "B", "C"),
        requirements=requirements,
        constraints=MissionConstraints(),
        area_threats={"A": 0.08, "B": 0.12, "C": 0.06},
        area_priorities={"A": 0.72, "B": 1.0, "C": 0.58},
        area_centers={"A": Point(x=25, y=30), "B": Point(x=63, y=39), "C": Point(x=52, y=67)},
        area_mission_types={
            "A": MissionType.AREA_RECON,
            "B": MissionType.COMM_RELAY,
            "C": MissionType.PERSISTENT_WATCH,
        },
    )


def default_vehicles(seed: int) -> tuple[Vehicle, ...]:
    synthetic = tuple(synthetic_wingman(index=index, seed=seed) for index in range(1, 13))
    return (
        Vehicle(
            id="UxV-01",
            type=VehicleType.FIXEDWING_SURVEY_UAV,
            label="Long-look scout",
            area=GCS_AREA,
            role=CapabilityName.VISUAL_RECON,
            position=_gcs_position(0),
            velocity=Point(x=0, y=0),
            health=HealthState(battery=0.82, comm=0.93, nav=0.9, sensor=0.92, health=0.96),
            capabilities=_capabilities_for(VehicleType.FIXEDWING_SURVEY_UAV),
            status=VehicleStatus.STANDBY,
        ),
        Vehicle(
            id="UxV-02",
            type=VehicleType.MICRO_SCOUT_UAV,
            label="Attritable probe",
            area=GCS_AREA,
            role=CapabilityName.VISUAL_RECON,
            position=_gcs_position(1),
            velocity=Point(x=0, y=0),
            health=HealthState(battery=0.31, comm=0.88, nav=0.84, sensor=0.78, health=0.91),
            capabilities=_capabilities_for(VehicleType.MICRO_SCOUT_UAV),
            status=VehicleStatus.STANDBY,
        ),
        Vehicle(
            id="UxV-03",
            type=VehicleType.OVERWATCH_UAV,
            label="B-sector scout",
            area=GCS_AREA,
            role=CapabilityName.OVERWATCH,
            position=_gcs_position(2),
            velocity=Point(x=0, y=0),
            health=HealthState(battery=0.69, comm=0.54, nav=0.86, sensor=0.89, health=0.94),
            capabilities=_capabilities_for(VehicleType.OVERWATCH_UAV),
            status=VehicleStatus.STANDBY,
        ),
        Vehicle(
            id="UxV-04",
            type=VehicleType.RELAY_UAV,
            label="Relay reserve",
            area=GCS_AREA,
            role=CapabilityName.RELAY,
            position=_gcs_position(3),
            velocity=Point(x=0, y=0),
            health=HealthState(battery=0.91, comm=0.97, nav=0.94, sensor=0.82, health=0.95),
            capabilities=_capabilities_for(VehicleType.RELAY_UAV),
            status=VehicleStatus.STANDBY,
        ),
        Vehicle(
            id="UxV-05",
            type=VehicleType.SENSOR_ROVER,
            label="Persistent overwatch",
            area=GCS_AREA,
            role=CapabilityName.OVERWATCH,
            position=_gcs_position(4),
            velocity=Point(x=0, y=0),
            health=HealthState(battery=0.76, comm=0.82, nav=0.38, sensor=0.91, health=0.93),
            capabilities=_capabilities_for(VehicleType.SENSOR_ROVER),
            status=VehicleStatus.STANDBY,
        ),
        Vehicle(
            id="UxV-06",
            type=VehicleType.SCOUT_ROVER,
            label="Ready replacement",
            area=GCS_AREA,
            role=CapabilityName.RESERVE,
            position=_gcs_position(5),
            velocity=Point(x=0, y=0),
            health=HealthState(battery=0.88, comm=0.9, nav=0.78, sensor=0.72, health=0.96),
            capabilities=_capabilities_for(VehicleType.SCOUT_ROVER),
            status=VehicleStatus.STANDBY,
        ),
        *synthetic,
    )


def synthetic_wingman(index: int, seed: int) -> Vehicle:
    area = ("A", "B", "C")[(index + seed) % 3]
    relay_bias = 0.12 if area != "B" else 0.22
    return Vehicle(
        id=f"SW-{index:02d}",
        type=VehicleType.SYNTHETIC_WINGMAN,
        label="Synthetic capability token",
        area=GCS_AREA,
        role=CapabilityName.VISUAL_RECON if index % 4 else CapabilityName.RELAY,
        position=_gcs_position(index + 5),
        velocity=Point(x=0, y=0),
        health=HealthState(
            battery=0.62 + ((index % 5) * 0.05),
            comm=0.7 + ((index % 4) * 0.04),
            nav=0.68 + ((index % 3) * 0.05),
            sensor=0.7 + ((index % 6) * 0.03),
            health=0.82,
            confidence=0.72,
        ),
        capabilities=CapabilityVector(
            visual_recon=0.22,
            relay=relay_bias,
            overwatch=0.18,
            gps_denied_nav=0.16,
            reserve=0.22,
        ),
        synthetic=True,
        status=VehicleStatus.STANDBY,
    )


def _capabilities_for(vehicle_type: VehicleType) -> CapabilityVector:
    return vehicle_type_profile(vehicle_type).capabilities


def _gcs_position(slot: int) -> Point:
    column = slot % 3
    row = slot // 3
    return Point(x=GCS_POINT.x - 3.9 + (column * 3.9), y=GCS_POINT.y + 3.2 + (row * 3.1))


def default_assignments() -> tuple[Assignment, ...]:
    return ()
