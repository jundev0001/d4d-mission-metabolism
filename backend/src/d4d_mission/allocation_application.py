from __future__ import annotations

from typing import TYPE_CHECKING

from d4d_mission.allocation_movement import GCS_AREA, staging_position
from d4d_mission.types import VehicleStatus

if TYPE_CHECKING:
    from d4d_mission.models import Assignment, Mission, Vehicle


def apply_allocation_to_vehicles(
    vehicles: tuple[Vehicle, ...],
    assignments: tuple[Assignment, ...],
    mission: Mission | None = None,
) -> tuple[Vehicle, ...]:
    assignments_by_vehicle = {assignment.vehicle_id: assignment for assignment in assignments}
    area_slots: dict[str, int] = {}
    updated: list[Vehicle] = []
    for vehicle in vehicles:
        if vehicle.status == VehicleStatus.LOST:
            updated.append(vehicle)
            continue
        assignment = assignments_by_vehicle.get(vehicle.id)
        if assignment is None:
            updated.append(
                vehicle.model_copy(
                    update={
                        "area": GCS_AREA,
                        "status": VehicleStatus.STANDBY,
                        "position": staging_position(
                            area=GCS_AREA,
                            slot=len(updated),
                            mission=mission,
                        ),
                    },
                ),
            )
            continue
        slot = area_slots.get(assignment.area, 0)
        area_slots[assignment.area] = slot + 1
        updated.append(
            vehicle.model_copy(
                update={
                    "area": assignment.area,
                    "role": assignment.role,
                    "status": VehicleStatus.ACTIVE,
                    "position": staging_position(
                        area=assignment.area,
                        slot=slot,
                        mission=mission,
                    ),
                },
            ),
        )
    return tuple(updated)
