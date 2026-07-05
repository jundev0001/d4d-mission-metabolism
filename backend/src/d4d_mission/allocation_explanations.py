from __future__ import annotations

from typing import TYPE_CHECKING, Final, Protocol

if TYPE_CHECKING:
    from d4d_mission.models import Assignment
    from d4d_mission.types import CapabilityName

MAX_EXPLANATIONS: Final = 4


class AllocationPlacement(Protocol):
    @property
    def assignment(self) -> Assignment: ...

    @property
    def capability(self) -> CapabilityName: ...

    @property
    def covered(self) -> float: ...

    @property
    def priority(self) -> float: ...

    @property
    def utility(self) -> float: ...

    @property
    def movement_cost(self) -> float: ...

    @property
    def battery_margin(self) -> float: ...

    @property
    def synthetic(self) -> bool: ...


def allocation_explanations(
    placements: tuple[AllocationPlacement, ...],
    reserve_count: int,
) -> tuple[str, ...]:
    filled = [
        placement for placement in placements if not placement.synthetic and placement.covered > 0
    ]
    ranked = sorted(
        filled,
        key=lambda placement: placement.covered * placement.priority,
        reverse=True,
    )
    explanations = [_explanation_line(placement) for placement in ranked[:MAX_EXPLANATIONS]]
    if reserve_count > 0:
        explanations.append(f"{reserve_count} UxVs remain at GCS reserve for rotation/replacement")
    return tuple(explanations)


def _explanation_line(placement: AllocationPlacement) -> str:
    assignment = placement.assignment
    delta = f"+{placement.covered:.2f}"
    utility = f"utility {placement.utility:.2f}"
    move = f"move {placement.movement_cost:.2f}"
    battery = f"battery margin {placement.battery_margin:.2f}"
    return (
        f"{assignment.vehicle_id} -> {assignment.area} "
        f"{placement.capability.value} {delta} ({utility}, {move}, {battery})"
    )
