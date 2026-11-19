"""Idempotent KIT Kanpur MCA Section A timetable and roster setup."""

from sqlalchemy.orm import Session

from app.models import ClassModel, Period, Room, Student, Subject, TimetableSlot


KIT_SUBJECT_CLASSES = (
    {
        "id": "class_mca_final",
        "name": "Computer Network (BMC303)",
        "code": "BMC303",
        "teacher": "Subodh Kumar",
        "schedule": "Tue 09:10–10:05 · Wed 11:10–12:05 · Fri 02:00–02:55",
        "slots": ((1, "P1"), (2, "P3"), (4, "P5")),
        "color": "#22D3EE",
    },
    {
        "id": "kit_mca_a_bmc301",
        "name": "Python Programming (BMC301)",
        "code": "BMC301",
        "teacher": "Prabhat Kumar Sharma",
        "schedule": "Tue 10:10–11:05 · Wed 02:00–02:55 · Thu 02:00–02:55 · Fri 11:10–12:05",
        "slots": ((1, "P2"), (2, "P5"), (3, "P5"), (4, "P3")),
        "color": "#6366F1",
    },
    {
        "id": "kit_mca_a_bmc302",
        "name": "Software Engineering (BMC302)",
        "code": "BMC302",
        "teacher": "Neha Patel",
        "schedule": "Tue 11:10–12:05 · Wed 09:10–10:05 · Thu 11:10–12:05",
        "slots": ((1, "P3"), (2, "P1"), (3, "P3")),
        "color": "#34D399",
    },
    {
        "id": "kit_mca_a_bmc014",
        "name": "Cloud Computing (BMC014)",
        "code": "BMC014",
        "teacher": "Mohammad Waseem",
        "schedule": "Tue 01:00–01:55 · Wed 10:10–11:05 · Fri 01:00–01:55",
        "slots": ((1, "P4"), (2, "P2"), (4, "P4")),
        "color": "#22D3EE",
    },
    {
        "id": "kit_mca_a_bmc021",
        "name": "Artificial Intelligence (BMC021)",
        "code": "BMC021",
        "teacher": "Ajeet Singh",
        "schedule": "Tue 02:00–02:55 · Wed 01:00–01:55 · Thu 01:00–01:55 · Fri 09:10–10:05",
        "slots": ((1, "P5"), (2, "P4"), (3, "P4"), (4, "P1")),
        "color": "#FBBF24",
    },
    {
        "id": "kit_mca_a_bmc351",
        "name": "Python Programming Lab (BMC351)",
        "code": "BMC351",
        "teacher": "Prabhat Kumar Sharma",
        "schedule": "Thu 09:10–11:05",
        "slots": ((3, "P1"), (3, "P2")),
        "color": "#A78BFA",
    },
    {
        "id": "kit_mca_a_bmc352",
        "name": "Software Engineering Lab (BMC352)",
        "code": "BMC352",
        "teacher": "Neha Patel",
        "schedule": "Fri 10:10–11:05",
        "slots": ((4, "P2"),),
        "color": "#F87171",
    },
)

PERIODS = (
    ("P1", "Period 1", "09:10 AM", "10:05 AM", 1, False),
    ("P2", "Period 2", "10:10 AM", "11:05 AM", 2, False),
    ("P3", "Period 3", "11:10 AM", "12:05 PM", 3, False),
    ("LUNCH", "Lunch", "12:05 PM", "01:00 PM", 4, True),
    ("P4", "Period 4", "01:00 PM", "01:55 PM", 5, False),
    ("P5", "Period 5", "02:00 PM", "02:55 PM", 6, False),
)


def synchronize_kit_timetable(db: Session, repair_mismatched_slots: bool = False) -> dict[str, int]:
    """Create real timetable entities and give every active student the same subject roster."""
    periods: dict[str, Period] = {}
    for period_id, label, start_time, end_time, order_index, is_break in PERIODS:
        period = db.get(Period, period_id)
        if not period:
            period = Period(id=period_id)
            db.add(period)
        period.label = label
        period.start_time = start_time
        period.end_time = end_time
        period.order_index = order_index
        period.is_break = is_break
        periods[period_id] = period

    room = db.get(Room, "kit_r228")
    if not room:
        room = Room(id="kit_r228")
        db.add(room)
    room.name = "1/R228"
    room.capacity = 60

    # The generic legacy MCA class is reused as BMC303, removing the stale placeholder.
    students = db.query(Student).filter(Student.deleted_at.is_(None)).order_by(Student.roll_number).all()
    classes_created = 0
    slots_created = 0

    slots_repaired = 0
    for definition in KIT_SUBJECT_CLASSES:
        classroom = db.get(ClassModel, definition["id"])
        if not classroom:
            classroom = ClassModel(id=definition["id"])
            db.add(classroom)
            classes_created += 1
        classroom.name = definition["name"]
        classroom.course = "MCA"
        classroom.section = "A"
        classroom.teacher_id = None
        classroom.teacher_name = definition["teacher"]
        classroom.schedule = definition["schedule"]

        subject = db.query(Subject).filter(Subject.code == definition["code"]).first()
        if not subject:
            subject = Subject(code=definition["code"])
            db.add(subject)
        subject.name = definition["name"].rsplit(" (", 1)[0]
        subject.color = definition["color"]
        subject.periods_per_week = len(definition["slots"])
        subject.is_heavy = len(definition["slots"]) > 3

        # This intentionally replaces this subject's membership with the shared class roster.
        # It never alters the student records themselves.
        classroom.students = list(students)
        db.flush()

        # A prior browser error could place a slot from another subject into a
        # section. Repair only during the one-time migration requested by the
        # administrator; normal later starts preserve timetable edits.
        if repair_mismatched_slots:
            expected = set(definition["slots"])
            for existing in list(classroom.timetable_slots):
                if (
                    existing.subject_id != subject.id
                    or (existing.day_of_week, existing.period_id) not in expected
                ):
                    db.delete(existing)
                    slots_repaired += 1
            db.flush()

        for day_of_week, period_id in definition["slots"]:
            slot = db.query(TimetableSlot).filter(
                TimetableSlot.class_id == classroom.id,
                TimetableSlot.day_of_week == day_of_week,
                TimetableSlot.period_id == period_id,
            ).first()
            if not slot:
                slot = TimetableSlot(
                    class_id=classroom.id,
                    day_of_week=day_of_week,
                    period_id=period_id,
                )
                db.add(slot)
                slots_created += 1
            slot.subject = subject
            slot.teacher_id = None
            slot.teacher_name = definition["teacher"]
            slot.room = room
            slot.slot_type = "lab" if "Lab" in definition["name"] else "lecture"
            slot.notes = "KIT Kanpur MCA Section A timetable"

    db.commit()
    return {
        "students_per_class": len(students),
        "classes_created": classes_created,
        "slots_created": slots_created,
        "slots_repaired": slots_repaired,
    }


def enroll_student_in_kit_subjects(db: Session, student: Student) -> None:
    """Keep new and imported MCA Section A students aligned with every subject class."""
    if (student.course or "").strip().upper() != "MCA":
        return
    subject_ids = [definition["id"] for definition in KIT_SUBJECT_CLASSES]
    for classroom in db.query(ClassModel).filter(ClassModel.id.in_(subject_ids)).all():
        if classroom not in student.classes:
            student.classes.append(classroom)
