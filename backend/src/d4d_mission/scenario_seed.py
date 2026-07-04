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
        objective="Maintain A/B/C ISR continuity with B-area relay redundancy",
        areas=("A", "B", "C"),
        requirements=requirements,
        constraints=MissionConstraints(),
        area_threats={"A": 0.08, "B": 0.12, "C": 0.06},
    )


def default_vehicles(seed: int) -> tuple[Vehicle, ...]:
    synthetic = tuple(synthetic_wingman(index=index, seed=seed) for index in range(1, 13))
    return (
        Vehicle(
            id="UxV-01",
            type=VehicleType.FIXEDWING_SURVEY_UAV,
            label="Long-look scout",
            area="A",
            role=CapabilityName.VISUAL_RECON,
            position=Point(x=18, y=28),
            velocity=Point(x=0.16, y=0.04),
            health=HealthState(battery=0.82, comm=0.93, nav=0.9, sensor=0.92, health=0.96),
            capabilities=_capabilities_for(VehicleType.FIXEDWING_SURVEY_UAV),
        ),
        Vehicle(
            id="UxV-02",
            type=VehicleType.MICRO_SCOUT_UAV,
            label="Attritable probe",
            area="B",
            role=CapabilityName.VISUAL_RECON,
            position=Point(x=46, y=42),
            velocity=Point(x=0.1, y=-0.02),
            health=HealthState(battery=0.31, comm=0.88, nav=0.84, sensor=0.78, health=0.91),
            capabilities=_capabilities_for(VehicleType.MICRO_SCOUT_UAV),
        ),
        Vehicle(
            id="UxV-03",
            type=VehicleType.OVERWATCH_UAV,
            label="B-sector scout",
            area="B",
            role=CapabilityName.OVERWATCH,
            position=Point(x=57, y=36),
            velocity=Point(x=-0.06, y=0.08),
            health=HealthState(battery=0.69, comm=0.54, nav=0.86, sensor=0.89, health=0.94),
            capabilities=_capabilities_for(VehicleType.OVERWATCH_UAV),
        ),
        Vehicle(
            id="UxV-04",
            type=VehicleType.RELAY_UAV,
            label="Relay reserve",
            area="B",
            role=CapabilityName.RELAY,
            position=Point(x=62, y=58),
            velocity=Point(x=-0.04, y=-0.06),
            health=HealthState(battery=0.91, comm=0.97, nav=0.94, sensor=0.82, health=0.95),
            capabilities=_capabilities_for(VehicleType.RELAY_UAV),
        ),
        Vehicle(
            id="UxV-05",
            type=VehicleType.SENSOR_ROVER,
            label="Persistent overwatch",
            area="C",
            role=CapabilityName.OVERWATCH,
            position=Point(x=76, y=66),
            velocity=Point(x=-0.03, y=0.02),
            health=HealthState(battery=0.76, comm=0.82, nav=0.38, sensor=0.91, health=0.93),
            capabilities=_capabilities_for(VehicleType.SENSOR_ROVER),
        ),
        Vehicle(
            id="UxV-06",
            type=VehicleType.SCOUT_ROVER,
            label="Ready replacement",
            area="A",
            role=CapabilityName.RESERVE,
            position=Point(x=32, y=72),
            velocity=Point(x=0.02, y=-0.02),
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
        area=area,
        role=CapabilityName.VISUAL_RECON if index % 4 else CapabilityName.RELAY,
        position=Point(x=10 + ((index * 7) % 80), y=12 + ((index * 11) % 72)),
        velocity=Point(x=0.01 * (index % 3), y=-0.01 * ((index + 1) % 3)),
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
    )


def _capabilities_for(vehicle_type: VehicleType) -> CapabilityVector:
    return vehicle_type_profile(vehicle_type).capabilities


def default_assignments() -> tuple[Assignment, ...]:
    return (
        Assignment(vehicle_id="UxV-01", area="A", role=CapabilityName.VISUAL_RECON),
        Assignment(vehicle_id="UxV-02", area="B", role=CapabilityName.VISUAL_RECON),
        Assignment(vehicle_id="UxV-03", area="B", role=CapabilityName.OVERWATCH),
        Assignment(vehicle_id="UxV-04", area="B", role=CapabilityName.RELAY),
        Assignment(vehicle_id="UxV-05", area="C", role=CapabilityName.OVERWATCH),
        Assignment(vehicle_id="UxV-06", area="A", role=CapabilityName.RESERVE, weight=0.5),
        *tuple(
            Assignment(
                vehicle_id=f"SW-{index:02d}",
                area=("A", "B", "C")[index % 3],
                role=CapabilityName.VISUAL_RECON if index % 4 else CapabilityName.RELAY,
                weight=0.75,
            )
            for index in range(1, 13)
        ),
    )
