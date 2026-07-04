from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from pathlib import Path

from d4d_mission.models import BlackBoxEntry


class JsonDumpModel(Protocol):
    def model_dump_json(self) -> str: ...


class JsonlBlackBox:
    def __init__(self, path: Path) -> None:
        self._path: Path = path
        self._entries: list[BlackBoxEntry] = []
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def record_model(
        self, scenario_time: int, kind: str, summary: str, model: JsonDumpModel
    ) -> None:
        entry = BlackBoxEntry(
            id=f"bb-{len(self._entries) + 1:04d}",
            scenario_time=scenario_time,
            kind=kind,
            summary=summary,
            payload_json=model.model_dump_json(),
        )
        self._entries.append(entry)
        with self._path.open("a", encoding="utf-8") as file:
            _ = file.write(f"{entry.model_dump_json()}\n")

    def entries(self) -> tuple[BlackBoxEntry, ...]:
        return tuple(self._entries)
