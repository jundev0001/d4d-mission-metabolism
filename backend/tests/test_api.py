from collections.abc import Callable, Mapping
from typing import cast

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from pydantic import BaseModel

from d4d_mission.main import create_app
from d4d_mission.models import (
    AllocationResponse,
    CalculationTrace,
    CapabilityGapReport,
    DashboardState,
    MissionCatalogResponse,
    RecommendationCard,
    ReplayResponse,
    VehicleTypeCatalogResponse,
)
from d4d_mission.types import DecisionAction, EventType

type ResponseModel = BaseModel


class ApiClient:
    def __init__(self) -> None:
        self._client: TestClient = TestClient(create_app())

    def get(self, url: str, *, headers: Mapping[str, str] | None = None) -> Response:
        get = cast("Callable[..., Response]", self._client.get)
        return get(url, headers=headers)

    def options(self, url: str, *, headers: Mapping[str, str] | None = None) -> Response:
        options = cast("Callable[..., Response]", self._client.options)
        return options(url, headers=headers)

    def post(self, url: str, *, json: object | None = None) -> Response:
        post = cast("Callable[..., Response]", self._client.post)
        return post(url, json=json)


def make_client() -> ApiClient:
    return ApiClient()


def response_model[T: ResponseModel](response: Response, model_type: type[T]) -> T:
    return model_type.model_validate_json(response.text)


def test_api_allows_vite_preview_origin_for_browser_qa() -> None:
    client = make_client()
    origin = "http://127.0.0.1:4173"

    state_response = client.get("/", headers={"Origin": origin})
    preflight_response = client.options(
        "/",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert state_response.status_code == 200
    assert state_response.headers["access-control-allow-origin"] == origin
    assert preflight_response.status_code == 200
    assert preflight_response.headers["access-control-allow-origin"] == origin


def test_api_mission_event_decision_and_replay_flow() -> None:
    client = make_client()

    mission_response = client.post("/mission", json={})
    assert mission_response.status_code == 200
    mission_payload = response_model(mission_response, DashboardState)
    assert mission_payload.mission.id == "mission-seoul-isr"
    assert mission_payload.mission.mission_type == "area_recon"
    assert mission_payload.assignments == ()
    assert {vehicle.area for vehicle in mission_payload.vehicles} == {"GCS"}

    mission_types_response = client.get("/mission/types")
    assert mission_types_response.status_code == 200
    assert len(response_model(mission_types_response, MissionCatalogResponse).templates) == 7

    vehicle_types_response = client.get("/vehicle/types")
    assert vehicle_types_response.status_code == 200
    assert len(response_model(vehicle_types_response, VehicleTypeCatalogResponse).profiles) == 8

    deploy_response = client.post(
        "/fleet/deploy",
        json={
            "items": [
                {"vehicle_type": "relay_uav", "count": 2},
                {"vehicle_type": "sensor_rover", "count": 3},
            ],
        },
    )
    assert deploy_response.status_code == 200
    deployed_payload = response_model(deploy_response, DashboardState)
    assert [vehicle.type for vehicle in deployed_payload.vehicles] == [
        "relay_uav",
        "relay_uav",
        "sensor_rover",
        "sensor_rover",
        "sensor_rover",
    ]
    assert deployed_payload.assignments == ()
    assert {vehicle.area for vehicle in deployed_payload.vehicles} == {"GCS"}
    assert all(vehicle.position.x > 89 for vehicle in deployed_payload.vehicles)
    assert all(vehicle.position.y <= 86 for vehicle in deployed_payload.vehicles)

    premature_event = client.post(
        "/event/inject",
        json={"event_type": EventType.COMM_JAM, "target": "B", "severity": 0.8},
    )
    assert premature_event.status_code == 409
    assert "initial allocation approval" in premature_event.json()["detail"]

    allocation_response = client.post("/allocate")
    assert allocation_response.status_code == 200
    assert len(response_model(allocation_response, AllocationResponse).assignments) > 0

    event_response = client.post(
        "/event/inject",
        json={"event_type": EventType.COMM_JAM, "target": "B", "severity": 0.8},
    )
    assert event_response.status_code == 200
    event_payload = response_model(event_response, DashboardState)
    card_id = event_payload.recommendations[0].id
    assert event_payload.metrics.collapse_probability > 0.3

    decision_response = client.post(
        "/decision",
        json={"recommendation_id": card_id, "action": DecisionAction.APPROVE},
    )
    assert decision_response.status_code == 200
    assert response_model(decision_response, DashboardState).recommendations[0].status == "approved"

    replay_response = client.get("/replay")
    assert replay_response.status_code == 200
    replay_entries = response_model(replay_response, ReplayResponse).entries
    assert len(replay_entries) >= 4
    resolved_cards = [
        RecommendationCard.model_validate_json(entry.payload_json)
        for entry in replay_entries
        if entry.kind == "recommendation" and entry.summary.startswith("approved ")
    ]
    assert resolved_cards[0].id == card_id
    assert resolved_cards[0].status == "approved"


def test_api_capability_gaps_rank_after_vehicle_loss() -> None:
    client = make_client()

    allocation = client.post("/allocate")
    assert allocation.status_code == 200

    healthy = client.post("/capability/gaps")
    assert healthy.status_code == 200
    assert not any(
        gap.area == "B" and gap.capability == "relay"
        for gap in response_model(healthy, CapabilityGapReport).gaps
    )

    loss = client.post(
        "/event/inject",
        json={"event_type": EventType.VEHICLE_LOST, "target": "UxV-04", "severity": 0.9},
    )
    assert loss.status_code == 200

    gaps_response = client.post("/capability/gaps")
    gaps = response_model(gaps_response, CapabilityGapReport).gaps
    relay_b = [gap for gap in gaps if gap.area == "B" and gap.capability == "relay"]
    assert len(relay_b) == 1
    assert relay_b[0].deficit_ratio > 0


def test_api_rejects_invalid_event_type_and_unknown_vehicle() -> None:
    client = make_client()

    invalid_type = client.post(
        "/event/inject",
        json={"event_type": "strike", "target": "B", "severity": 0.8},
    )
    assert invalid_type.status_code == 422

    allocation = client.post("/allocate")
    assert allocation.status_code == 200

    unknown_vehicle = client.post(
        "/event/inject",
        json={"event_type": EventType.BATTERY_DROP, "target": "UxV-99", "severity": 0.7},
    )
    assert unknown_vehicle.status_code == 404


def test_api_accepts_new_tactical_immune_event_targets() -> None:
    client = make_client()

    allocation = client.post("/allocate")
    assert allocation.status_code == 200

    area_event = client.post(
        "/event/inject",
        json={"event_type": EventType.DATA_STALE, "target": "A", "severity": 0.65},
    )
    assert area_event.status_code == 200
    area_payload = response_model(area_event, DashboardState)
    assert area_payload.recommendations[0].actions[0].action == "mark_area_stale"

    vehicle_event = client.post(
        "/event/inject",
        json={"event_type": EventType.SENSOR_FAIL, "target": "UxV-05", "severity": 0.7},
    )
    assert vehicle_event.status_code == 200
    vehicle_payload = response_model(vehicle_event, DashboardState)
    assert len(vehicle_payload.recommendations[0].actions) > 0


def test_api_allocate_applies_and_explains() -> None:
    client = make_client()

    response = client.post("/allocate")

    assert response.status_code == 200
    body = response_model(response, AllocationResponse)
    assert len(body.assignments) > 0
    assert len(body.explanations) > 0
    state = response_model(client.get("/"), DashboardState)
    assigned_ids = {assignment.vehicle_id for assignment in body.assignments}
    assert any(vehicle.area == "GCS" for vehicle in state.vehicles)
    assert all(vehicle.area != "GCS" for vehicle in state.vehicles if vehicle.id in assigned_ids)


def test_api_advance_drains_battery_and_adds_proactive_rotation_card() -> None:
    client = make_client()

    allocation = client.post("/allocate")
    assert allocation.status_code == 200
    before = response_model(client.get("/"), DashboardState)
    active_vehicle = next(vehicle for vehicle in before.vehicles if vehicle.status == "active")

    response = client.post("/mission/advance", json={"steps": 3})

    assert response.status_code == 200
    after = response_model(response, DashboardState)
    advanced_vehicle = next(
        vehicle for vehicle in after.vehicles if vehicle.id == active_vehicle.id
    )
    assert after.scenario_time == before.scenario_time + 90
    assert advanced_vehicle.health.battery < active_vehicle.health.battery
    assert any("predicted_battery_drop" in card.causes for card in after.recommendations)


def test_api_advance_charges_standby_assets_at_gcs() -> None:
    client = make_client()
    before = response_model(client.get("/"), DashboardState)
    charging_asset = next(vehicle for vehicle in before.vehicles if vehicle.id == "UxV-02")

    response = client.post("/mission/advance", json={"steps": 2})

    assert response.status_code == 200
    after = response_model(response, DashboardState)
    charged_asset = next(vehicle for vehicle in after.vehicles if vehicle.id == "UxV-02")
    assert charged_asset.area == "GCS"
    assert charged_asset.status == "standby"
    assert charged_asset.health.battery > charging_asset.health.battery
    assert charged_asset.health.battery <= 1.0


def test_api_configures_custom_areas_before_allocation() -> None:
    client = make_client()

    configured = client.post(
        "/mission/configure",
        json={
            "objective": "Custom drawn areas",
            "mission_type": "area_recon",
            "constraints": {
                "return_battery_threshold": 0.28,
                "min_relay_redundancy": 2,
                "human_approval_for_replan": False,
                "target_mcc": 0.86,
            },
            "autonomy_level": 0.74,
            "areas": [
                {
                    "id": "alpha",
                    "label": "Alpha",
                    "mission_type": "area_recon",
                    "requirements": {
                        "visual_recon": 1.0,
                        "relay": 0.2,
                        "overwatch": 0.3,
                        "gps_denied_nav": 0.1,
                        "reserve": 0.1,
                    },
                    "priority": 0.9,
                    "threat": 0.12,
                    "center": {"x": 18, "y": 24},
                },
                {
                    "id": "bravo",
                    "label": "Bravo",
                    "mission_type": "comm_relay",
                    "requirements": {
                        "visual_recon": 0.2,
                        "relay": 1.0,
                        "overwatch": 0.2,
                        "gps_denied_nav": 0.1,
                        "reserve": 0.2,
                    },
                    "priority": 0.7,
                    "threat": 0.08,
                    "center": {"x": 76, "y": 36},
                },
            ],
        },
    )

    assert configured.status_code == 200
    payload = response_model(configured, DashboardState)
    assert payload.mission.areas == ("alpha", "bravo")
    assert payload.mission.constraints.return_battery_threshold == 0.28
    assert payload.mission.constraints.min_relay_redundancy == 2
    assert payload.mission.constraints.human_approval_for_replan is False
    assert payload.mission.constraints.target_mcc == 0.86
    assert payload.mission.autonomy_level == 0.74
    assert payload.mission.area_centers["alpha"].model_dump() == {"x": 18.0, "y": 24.0}
    assert payload.mission.area_mission_types["bravo"] == "comm_relay"
    assert payload.assignments == ()
    assert {vehicle.area for vehicle in payload.vehicles} == {"GCS"}

    allocation = client.post("/allocate")

    assert allocation.status_code == 200
    assigned_areas = {
        assignment.area for assignment in response_model(allocation, AllocationResponse).assignments
    }
    assert len(assigned_areas) > 0
    assert assigned_areas <= {"alpha", "bravo"}


def test_api_event_injection_does_not_count_as_operator_action() -> None:
    client = make_client()
    allocation = client.post("/allocate")
    assert allocation.status_code == 200
    initial_actions = response_model(client.get("/"), DashboardState).metrics.operator_actions

    event_response = client.post(
        "/event/inject",
        json={"event_type": EventType.COMM_JAM, "target": "B", "severity": 0.8},
    )

    assert event_response.status_code == 200
    event_payload = response_model(event_response, DashboardState)
    card_id = event_payload.recommendations[0].id
    assert event_payload.metrics.operator_actions == initial_actions

    decision_response = client.post(
        "/decision",
        json={"recommendation_id": card_id, "action": DecisionAction.APPROVE},
    )

    assert decision_response.status_code == 200
    assert (
        response_model(decision_response, DashboardState).metrics.operator_actions
        == initial_actions + 1
    )


def test_api_keeps_paired_baseline_after_assisted_decision() -> None:
    client = make_client()
    allocation = client.post("/allocate")
    assert allocation.status_code == 200

    event_response = client.post(
        "/event/inject",
        json={"event_type": EventType.BATTERY_DROP, "target": "UxV-02", "severity": 0.9},
    )
    assert event_response.status_code == 200
    event_payload = response_model(event_response, DashboardState)
    card_id = event_payload.recommendations[0].id
    event_baseline = event_payload.baseline_metrics

    decision_response = client.post(
        "/decision",
        json={"recommendation_id": card_id, "action": DecisionAction.APPROVE},
    )

    assert decision_response.status_code == 200
    decision_payload = response_model(decision_response, DashboardState)
    assert decision_payload.baseline_metrics.mcc == event_baseline.mcc
    assert (
        decision_payload.baseline_metrics.operator_actions
        > decision_payload.metrics.operator_actions
    )
    assert (
        decision_payload.baseline_metrics.collapse_probability
        >= decision_payload.metrics.collapse_probability
    )


def test_api_exposes_paired_baseline_metrics() -> None:
    client = make_client()

    response = client.get("/")

    assert response.status_code == 200
    payload = response_model(response, DashboardState)
    assert payload.baseline_metrics.operator_actions == payload.baseline_operator_actions
    assert payload.baseline_metrics.replan_time_seconds > 0
    assert payload.baseline_metrics.collapse_probability >= 0


def test_api_tunes_vehicle_status_parameters_and_records_calculation() -> None:
    client = make_client()

    response = client.post(
        "/fleet/vehicle/tune",
        json={
            "vehicle_id": "UxV-04",
            "health": {
                "battery": 0.42,
                "comm": 0.51,
                "nav": 0.94,
                "sensor": 0.82,
                "health": 0.88,
                "confidence": 0.74,
                "degradation_reason": "operator degraded relay test",
            },
            "status": "standby",
        },
    )

    assert response.status_code == 200
    payload = response_model(response, DashboardState)
    tuned_vehicle = next(vehicle for vehicle in payload.vehicles if vehicle.id == "UxV-04")
    assert tuned_vehicle.health.battery == 0.42
    assert tuned_vehicle.health.comm == 0.51
    assert tuned_vehicle.status == "standby"
    assert payload.baseline_metrics.mcc == payload.metrics.mcc

    replay_response = client.get("/replay")
    assert replay_response.status_code == 200
    replay_entries = response_model(replay_response, ReplayResponse).entries
    calculation_entries = [entry for entry in replay_entries if entry.kind == "calculation"]
    assert len(calculation_entries) > 0
    assert "vehicle parameter tune" in calculation_entries[-1].summary
    trace = CalculationTrace.model_validate_json(calculation_entries[-1].payload_json)
    assert trace.trigger == "vehicle_parameter_tune"
    assert trace.mcc == payload.metrics.mcc
    assert trace.baseline_mcc == payload.baseline_metrics.mcc
    assert set(trace.area_mcc) == set(payload.mission.areas)


def test_api_reads_cors_origins_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    origin = "https://demo.example.test"
    monkeypatch.setenv("D4D_CORS_ORIGINS", f"{origin}, http://127.0.0.1:4173")
    client = make_client()

    response = client.options(
        "/",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_api_uses_default_cors_when_environment_is_blank(monkeypatch: pytest.MonkeyPatch) -> None:
    origin = "http://127.0.0.1:4173"
    monkeypatch.setenv("D4D_CORS_ORIGINS", "   ")
    client = make_client()

    response = client.options(
        "/",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_api_rejects_empty_deployment() -> None:
    client = make_client()

    response = client.post(
        "/fleet/deploy",
        json={"items": [{"vehicle_type": "relay_uav", "count": 0}]},
    )

    assert response.status_code == 422
