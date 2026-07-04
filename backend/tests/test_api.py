import json

from fastapi.testclient import TestClient

from d4d_mission.main import create_app
from d4d_mission.types import DecisionAction, EventType


def test_api_mission_event_decision_and_replay_flow() -> None:
    client = TestClient(create_app())

    mission_response = client.post("/mission", json={})
    assert mission_response.status_code == 200
    assert mission_response.json()["mission"]["id"] == "mission-seoul-isr"
    assert mission_response.json()["mission"]["mission_type"] == "area_recon"
    assert mission_response.json()["assignments"] == []
    assert {vehicle["area"] for vehicle in mission_response.json()["vehicles"]} == {"GCS"}

    mission_types_response = client.get("/mission/types")
    assert mission_types_response.status_code == 200
    assert len(mission_types_response.json()["templates"]) == 7

    vehicle_types_response = client.get("/vehicle/types")
    assert vehicle_types_response.status_code == 200
    assert len(vehicle_types_response.json()["profiles"]) == 8

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
    deployed_payload = deploy_response.json()
    assert [vehicle["type"] for vehicle in deployed_payload["vehicles"]] == [
        "relay_uav",
        "relay_uav",
        "sensor_rover",
        "sensor_rover",
        "sensor_rover",
    ]
    assert deployed_payload["assignments"] == []
    assert {vehicle["area"] for vehicle in deployed_payload["vehicles"]} == {"GCS"}

    allocation_response = client.post("/allocate")
    assert allocation_response.status_code == 200
    assert len(allocation_response.json()["assignments"]) > 0

    event_response = client.post(
        "/event/inject",
        json={"event_type": EventType.COMM_JAM, "target": "B", "severity": 0.8},
    )
    assert event_response.status_code == 200
    event_payload = event_response.json()
    card_id = event_payload["recommendations"][0]["id"]
    assert event_payload["metrics"]["collapse_probability"] > 0.3

    decision_response = client.post(
        "/decision",
        json={"recommendation_id": card_id, "action": DecisionAction.APPROVE},
    )
    assert decision_response.status_code == 200
    assert decision_response.json()["recommendations"][0]["status"] == "approved"

    replay_response = client.get("/replay")
    assert replay_response.status_code == 200
    replay_entries = replay_response.json()["entries"]
    assert len(replay_entries) >= 4
    resolved_cards = [
        json.loads(entry["payload_json"])
        for entry in replay_entries
        if entry["kind"] == "recommendation" and entry["summary"].startswith("approved ")
    ]
    assert resolved_cards[0]["id"] == card_id
    assert resolved_cards[0]["status"] == "approved"


def test_api_capability_gaps_rank_after_vehicle_loss() -> None:
    client = TestClient(create_app())

    allocation = client.post("/allocate")
    assert allocation.status_code == 200

    healthy = client.post("/capability/gaps")
    assert healthy.status_code == 200
    assert not any(
        gap["area"] == "B" and gap["capability"] == "relay" for gap in healthy.json()["gaps"]
    )

    loss = client.post(
        "/event/inject",
        json={"event_type": EventType.VEHICLE_LOST, "target": "UxV-04", "severity": 0.9},
    )
    assert loss.status_code == 200

    gaps = client.post("/capability/gaps").json()["gaps"]
    relay_b = [gap for gap in gaps if gap["area"] == "B" and gap["capability"] == "relay"]
    assert len(relay_b) == 1
    assert relay_b[0]["deficit_ratio"] > 0


def test_api_rejects_invalid_event_type_and_unknown_vehicle() -> None:
    client = TestClient(create_app())

    invalid_type = client.post(
        "/event/inject",
        json={"event_type": "strike", "target": "B", "severity": 0.8},
    )
    assert invalid_type.status_code == 422

    unknown_vehicle = client.post(
        "/event/inject",
        json={"event_type": EventType.BATTERY_DROP, "target": "UxV-99", "severity": 0.7},
    )
    assert unknown_vehicle.status_code == 404


def test_api_accepts_new_tactical_immune_event_targets() -> None:
    client = TestClient(create_app())

    area_event = client.post(
        "/event/inject",
        json={"event_type": EventType.DATA_STALE, "target": "A", "severity": 0.65},
    )
    assert area_event.status_code == 200
    assert area_event.json()["recommendations"][0]["actions"][0]["action"] == "mark_area_stale"

    vehicle_event = client.post(
        "/event/inject",
        json={"event_type": EventType.MOBILITY_BLOCKED, "target": "UxV-05", "severity": 0.7},
    )
    assert vehicle_event.status_code == 200
    assert vehicle_event.json()["recommendations"][0]["actions"][0]["action"] == "reroute"


def test_api_allocate_applies_and_explains() -> None:
    client = TestClient(create_app())

    response = client.post("/allocate")

    assert response.status_code == 200
    body = response.json()
    assert len(body["assignments"]) > 0
    assert len(body["explanations"]) > 0
    state = client.get("/").json()
    assigned_ids = {assignment["vehicle_id"] for assignment in body["assignments"]}
    assert any(vehicle["area"] == "GCS" for vehicle in state["vehicles"])
    assert all(
        vehicle["area"] != "GCS"
        for vehicle in state["vehicles"]
        if vehicle["id"] in assigned_ids
    )


def test_api_rejects_empty_deployment() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/fleet/deploy",
        json={"items": [{"vehicle_type": "relay_uav", "count": 0}]},
    )

    assert response.status_code == 422
