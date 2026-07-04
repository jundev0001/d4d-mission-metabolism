from __future__ import annotations

from pathlib import Path
from typing import NoReturn

import anyio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from d4d_mission.immune import ManualActionError, RecommendationNotFoundError
from d4d_mission.models import (
    AllocationResponse,
    CapabilityReport,
    DashboardState,
    DecisionRequest,
    EventRequest,
    FleetStateResponse,
    MetricSnapshot,
    RecommendationCard,
    ReplayResponse,
    StrictModel,
)
from d4d_mission.state import MissionRuntime, UnknownTargetError, runtime_error_to_status


class MissionCreateRequest(StrictModel):
    seed: int = 42


def create_app() -> FastAPI:
    runtime = MissionRuntime(log_path=Path("data/blackbox.jsonl"))
    app = FastAPI(title="D4D Mission Metabolism API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", response_model=DashboardState)
    async def read_state() -> DashboardState:
        return runtime.snapshot

    @app.post("/mission", response_model=DashboardState)
    async def create_mission(payload: MissionCreateRequest) -> DashboardState:
        return runtime.reset(seed=payload.seed)

    @app.get("/fleet/state", response_model=FleetStateResponse)
    async def fleet_state() -> FleetStateResponse:
        return runtime.fleet_state()

    @app.post("/capability/compute", response_model=CapabilityReport)
    async def capability_compute() -> CapabilityReport:
        return runtime.capability_report()

    @app.post("/allocate", response_model=AllocationResponse)
    async def allocate() -> AllocationResponse:
        return runtime.allocation()

    @app.post("/event/inject", response_model=DashboardState)
    async def event_inject(event: EventRequest) -> DashboardState:
        try:
            return runtime.inject_event(event=event)
        except (UnknownTargetError, RecommendationNotFoundError, ManualActionError) as error:
            _raise_http(error)

    @app.post("/immune/respond", response_model=RecommendationCard)
    async def immune_respond(event: EventRequest) -> RecommendationCard:
        try:
            return runtime.respond(event=event)
        except (UnknownTargetError, RecommendationNotFoundError, ManualActionError) as error:
            _raise_http(error)

    @app.post("/metabolism/evaluate", response_model=MetricSnapshot)
    async def metabolism_evaluate() -> MetricSnapshot:
        return runtime.metrics()

    @app.post("/decision", response_model=DashboardState)
    async def decision(request: DecisionRequest) -> DashboardState:
        try:
            return runtime.decide(request=request)
        except (UnknownTargetError, RecommendationNotFoundError, ManualActionError) as error:
            _raise_http(error)

    @app.get("/metrics", response_model=MetricSnapshot)
    async def metrics() -> MetricSnapshot:
        return runtime.metrics()

    @app.get("/replay", response_model=ReplayResponse)
    async def replay() -> ReplayResponse:
        return runtime.replay()

    @app.websocket("/ws/state")
    async def websocket_state(websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            while True:
                await websocket.send_text(runtime.snapshot.model_dump_json())
                await anyio.sleep(1)
        except WebSocketDisconnect:
            return

    return app


def _raise_http(error: Exception) -> NoReturn:
    status_code = runtime_error_to_status(error)
    raise HTTPException(status_code=status_code, detail=str(error)) from error


app = create_app()
