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
    assert [assignment["vehicle_id"] for assignment in deployed_payload["assignments"]] == [
        "UxV-01",
        "UxV-02",
        "UxV-03",
        "UxV-04",
        "UxV-05",
    ]

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


def test_api_rejects_empty_deployment() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/fleet/deploy",
        json={"items": [{"vehicle_type": "relay_uav", "count": 0}]},
    )

    assert response.status_code == 422
