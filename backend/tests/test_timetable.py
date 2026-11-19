def test_timetable_catalog_conflicts_and_session_link(client, admin_headers):
    classes = client.get("/api/classes", headers=admin_headers).json()
    assert classes

    subject = client.post("/api/timetable/subjects", json={
        "code": "TTEST101", "name": "Timetable Test Subject", "color": "#005D5A"
    }, headers=admin_headers)
    assert subject.status_code == 200

    room = client.post("/api/timetable/rooms", json={"name": "TEST-RM-01", "capacity": 40}, headers=admin_headers)
    assert room.status_code == 200

    period = client.post("/api/timetable/periods", json={
        "label": "Test Period", "start_time": "09:00", "end_time": "09:50", "order_index": 91
    }, headers=admin_headers)
    assert period.status_code == 200

    slot_payload = {
        "class_id": classes[0]["id"], "subject_id": subject.json()["id"], "room_id": room.json()["id"],
        "period_id": period.json()["id"], "day_of_week": 0, "slot_type": "lecture"
    }
    slot = client.post("/api/timetable/slots", json=slot_payload, headers=admin_headers)
    assert slot.status_code == 200
    assert slot.json()["subject_code"] == "TTEST101"

    conflict = client.post("/api/timetable/slots", json=slot_payload, headers=admin_headers)
    assert conflict.status_code == 409

    session = client.post(f"/api/timetable/slots/{slot.json()['id']}/attendance-session?date=2026-11-05", headers=admin_headers)
    assert session.status_code == 200
    assert session.json()["class_id"] == classes[0]["id"]
