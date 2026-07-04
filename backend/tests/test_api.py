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
    assert len(replay_response.json()["entries"]) >= 3


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
