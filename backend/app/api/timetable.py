from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_admin, require_teacher_or_admin
from app.db.database import get_db
from app.models import (
    AttendanceSession, ClassModel, Holiday, Period, Room, Subject,
    SystemSetting, TimetableSlot, User,
)
from app.schemas import (
    HolidayCreate, PeriodCreate, RoomCreate, SubjectCreate,
    TimetableSlotCreate, TimetableSlotUpdate,
)
from app.services.attendance_svc import AttendanceService

router = APIRouter(prefix="/timetable", tags=["timetable"])


def clean_slot_values(values: dict) -> dict:
    """Convert optional form fields from the UI into database-safe values.

    HTML selects use an empty string for an unselected option. PostgreSQL treats
    that as a real foreign-key value, so nullable timetable fields must become
    None before a slot is inserted or updated.
    """
    cleaned = dict(values)
    for field in ("teacher_id", "teacher_name", "room_id", "notes", "substitute_teacher_id"):
        if isinstance(cleaned.get(field), str):
            cleaned[field] = cleaned[field].strip() or None
    return cleaned


def serialize_slot(slot: TimetableSlot) -> dict:
    return {
        "id": slot.id,
        "class_id": slot.class_id,
        "class_name": f"{slot.classroom.name} — {slot.classroom.section}" if slot.classroom else "Class",
        "subject_id": slot.subject_id,
        "subject_code": slot.subject.code if slot.subject else "",
        "subject_name": slot.subject.name if slot.subject else "Untitled subject",
        "color": slot.subject.color if slot.subject else "#3157D5",
        "teacher_id": slot.teacher_id,
        "teacher_name": slot.teacher.full_name if slot.teacher else (slot.teacher_name or (slot.classroom.teacher_name if slot.classroom else "Unassigned")),
        "room_id": slot.room_id,
        "room_name": slot.room.name if slot.room else "Room pending",
        "period_id": slot.period_id,
        "period_label": slot.period.label if slot.period else "",
        "start_time": slot.period.start_time if slot.period else "",
        "end_time": slot.period.end_time if slot.period else "",
        "day_of_week": slot.day_of_week,
        "slot_type": slot.slot_type,
        "notes": slot.notes,
        "is_cancelled": slot.is_cancelled,
        "substitute_teacher_id": slot.substitute_teacher_id,
        "substitute_teacher_name": slot.substitute_teacher.full_name if slot.substitute_teacher else None,
    }


def find_conflicts(db: Session, candidate: TimetableSlot, exclude_id: Optional[str] = None) -> list[str]:
    query = db.query(TimetableSlot).filter(
        TimetableSlot.day_of_week == candidate.day_of_week,
        TimetableSlot.period_id == candidate.period_id,
        TimetableSlot.is_cancelled == False,
    )
    if exclude_id:
        query = query.filter(TimetableSlot.id != exclude_id)

    conflicts = []
    for slot in query.all():
        if slot.class_id == candidate.class_id:
            conflicts.append("This class already has a subject scheduled in that period.")
        if candidate.teacher_id and slot.teacher_id == candidate.teacher_id:
            conflicts.append("That teacher is already assigned in this period.")
        if candidate.teacher_name and slot.teacher_name and slot.teacher_name.casefold() == candidate.teacher_name.casefold():
            conflicts.append("That teacher is already assigned in this period.")
        if candidate.room_id and slot.room_id == candidate.room_id:
            conflicts.append("That room is already booked in this period.")
    return list(dict.fromkeys(conflicts))


def ensure_references(db: Session, payload: TimetableSlotCreate | TimetableSlotUpdate, current: Optional[TimetableSlot] = None) -> None:
    class_id = payload.class_id if payload.class_id is not None else getattr(current, "class_id", None)
    subject_id = payload.subject_id if payload.subject_id is not None else getattr(current, "subject_id", None)
    period_id = payload.period_id if payload.period_id is not None else getattr(current, "period_id", None)
    room_id = payload.room_id if payload.room_id is not None else getattr(current, "room_id", None)
    teacher_id = payload.teacher_id if payload.teacher_id is not None else getattr(current, "teacher_id", None)
    if not db.get(ClassModel, class_id):
        raise HTTPException(status_code=404, detail="Class section not found.")
    if not db.get(Subject, subject_id):
        raise HTTPException(status_code=404, detail="Subject not found.")
    if not db.get(Period, period_id):
        raise HTTPException(status_code=404, detail="Period not found.")
    if room_id and not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found.")
    if teacher_id and not db.get(User, teacher_id):
        raise HTTPException(status_code=404, detail="Teacher not found.")


@router.get("")
def get_timetable(
    class_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    teacher_name: Optional[str] = None,
    room_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    query = db.query(TimetableSlot)
    if class_id:
        query = query.filter(TimetableSlot.class_id == class_id)
    if teacher_id:
        query = query.filter(TimetableSlot.teacher_id == teacher_id)
    if teacher_name:
        query = query.filter(TimetableSlot.teacher_name == teacher_name)
    if room_id:
        query = query.filter(TimetableSlot.room_id == room_id)
    if user.role == "teacher":
        query = query.filter((TimetableSlot.teacher_id == user.id) | (TimetableSlot.class_id.in_([c.id for c in db.query(ClassModel).filter(ClassModel.teacher_id == user.id).all()])))
    return [serialize_slot(slot) for slot in query.all()]


@router.get("/catalog")
def get_catalog(
    db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)
):
    classes = db.query(ClassModel).all()
    if user.role == "teacher":
        classes = [c for c in classes if c.teacher_id == user.id or c.teacher_name == user.full_name]
    return {
        "classes": [{"id": c.id, "name": c.name, "section": c.section, "course": c.course, "teacher_id": c.teacher_id, "teacher_name": c.teacher_name} for c in classes],
        "subjects": [{"id": s.id, "code": s.code, "name": s.name, "color": s.color, "periods_per_week": s.periods_per_week, "is_heavy": s.is_heavy} for s in db.query(Subject).order_by(Subject.code).all()],
        "rooms": [{"id": r.id, "name": r.name, "capacity": r.capacity} for r in db.query(Room).order_by(Room.name).all()],
        "periods": [{"id": p.id, "label": p.label, "start_time": p.start_time, "end_time": p.end_time, "order_index": p.order_index, "is_break": p.is_break} for p in db.query(Period).order_by(Period.order_index).all()],
        "teachers": [{"id": t.id, "name": t.full_name} for t in db.query(User).filter(User.is_active == True).order_by(User.full_name).all()] + [{"id": f"name:{name}", "name": name} for (name,) in db.query(TimetableSlot.teacher_name).filter(TimetableSlot.teacher_name.isnot(None)).distinct().order_by(TimetableSlot.teacher_name).all() if name],
        "holidays": [{"id": h.id, "date": h.date, "name": h.name} for h in db.query(Holiday).order_by(Holiday.date).all()],
        "metadata": {setting.key: setting.value for setting in db.query(SystemSetting).filter(SystemSetting.key.in_(["INSTITUTION_NAME", "TIMETABLE_PROGRAM", "TIMETABLE_SECTION", "TIMETABLE_EFFECTIVE_DATE"])).all()},
    }


@router.post("/subjects")
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if db.query(Subject).filter(Subject.code == payload.code.strip()).first():
        raise HTTPException(status_code=409, detail="A subject with that code already exists.")
    subject_data = payload.model_dump(exclude_none=True)
    subject_data["code"] = payload.code.strip().upper()
    subject_data["name"] = payload.name.strip()
    subject = Subject(**subject_data)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return {"id": subject.id, "code": subject.code, "name": subject.name, "color": subject.color, "periods_per_week": subject.periods_per_week, "is_heavy": subject.is_heavy}


@router.post("/rooms")
def create_room(payload: RoomCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if db.query(Room).filter(Room.name == payload.name.strip()).first():
        raise HTTPException(status_code=409, detail="A room with that name already exists.")
    room = Room(name=payload.name.strip(), capacity=payload.capacity)
    db.add(room)
    db.commit()
    db.refresh(room)
    return {"id": room.id, "name": room.name, "capacity": room.capacity}


@router.post("/periods")
def create_period(payload: PeriodCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if db.query(Period).filter(Period.order_index == payload.order_index).first():
        raise HTTPException(status_code=409, detail="A period already uses that order.")
    period = Period(**payload.model_dump())
    db.add(period)
    db.commit()
    db.refresh(period)
    return {"id": period.id, "label": period.label, "start_time": period.start_time, "end_time": period.end_time, "order_index": period.order_index, "is_break": period.is_break}


@router.post("/holidays")
def create_holiday(payload: HolidayCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if db.query(Holiday).filter(Holiday.date == payload.date).first():
        raise HTTPException(status_code=409, detail="A holiday is already registered for that date.")
    holiday = Holiday(**payload.model_dump())
    db.add(holiday)
    db.commit()
    return {"id": holiday.id, "date": holiday.date, "name": holiday.name}


@router.post("/slots")
def create_slot(payload: TimetableSlotCreate, db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    ensure_references(db, payload)
    slot = TimetableSlot(**clean_slot_values(payload.model_dump()))
    conflicts = find_conflicts(db, slot)
    if conflicts:
        raise HTTPException(status_code=409, detail={"message": "Timetable conflict", "conflicts": conflicts})
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return serialize_slot(slot)


@router.put("/slots/{slot_id}")
def update_slot(slot_id: str, payload: TimetableSlotUpdate, db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    slot = db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found.")
    ensure_references(db, payload, slot)
    for field, value in clean_slot_values(payload.model_dump(exclude_unset=True)).items():
        setattr(slot, field, value)
    conflicts = find_conflicts(db, slot, exclude_id=slot.id)
    if conflicts:
        db.rollback()
        raise HTTPException(status_code=409, detail={"message": "Timetable conflict", "conflicts": conflicts})
    db.commit()
    db.refresh(slot)
    return serialize_slot(slot)


@router.delete("/slots/{slot_id}")
def delete_slot(slot_id: str, db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    slot = db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found.")
    db.delete(slot)
    db.commit()
    return {"success": True}


@router.post("/auto-arrange")
def auto_arrange_timetable(class_id: str, db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    """Fill open weekly periods from subject frequency, without overriding any manual slot."""
    classroom = db.get(ClassModel, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class section not found.")
    periods = db.query(Period).filter(Period.is_break == False).order_by(Period.order_index).all()
    subjects = db.query(Subject).order_by(Subject.code).all()
    if not periods or not subjects:
        raise HTTPException(status_code=409, detail="Add at least one teaching period and subject before auto-arranging.")

    slots = db.query(TimetableSlot).filter(TimetableSlot.class_id == class_id).all()
    created = []
    for subject in subjects:
        remaining = max(subject.periods_per_week - sum(1 for slot in slots if slot.subject_id == subject.id), 0)
        for _ in range(remaining):
            placed = False
            for day in range(6):
                for period in periods:
                    if any(slot.day_of_week == day and slot.period_id == period.id for slot in slots):
                        continue
                    candidate = TimetableSlot(
                        class_id=class_id,
                        subject_id=subject.id,
                        teacher_id=classroom.teacher_id,
                        period_id=period.id,
                        day_of_week=day,
                        slot_type="lab" if "lab" in subject.name.lower() else "lecture",
                    )
                    if find_conflicts(db, candidate):
                        continue
                    if subject.is_heavy and any(
                        slot.day_of_week == day and slot.subject and slot.subject.is_heavy and abs(slot.period.order_index - period.order_index) == 1
                        for slot in slots if slot.period
                    ):
                        continue
                    db.add(candidate)
                    slots.append(candidate)
                    created.append(candidate)
                    placed = True
                    break
                if placed:
                    break
            if not placed:
                db.rollback()
                raise HTTPException(status_code=409, detail=f"No conflict-free period remains for {subject.code}.")
    db.commit()
    for slot in created:
        db.refresh(slot)
    return {"created": [serialize_slot(slot) for slot in created]}


@router.post("/slots/{slot_id}/swap/{target_slot_id}")
def swap_slots(slot_id: str, target_slot_id: str, db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    slot = db.get(TimetableSlot, slot_id)
    target = db.get(TimetableSlot, target_slot_id)
    if not slot or not target:
        raise HTTPException(status_code=404, detail="One of the timetable slots no longer exists.")
    if slot.class_id != target.class_id:
        raise HTTPException(status_code=409, detail="Slots can only be swapped within the same class section.")
    slot.day_of_week, target.day_of_week = target.day_of_week, slot.day_of_week
    slot.period_id, target.period_id = target.period_id, slot.period_id
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="The slots could not be swapped because of a timetable conflict.")
    db.refresh(slot)
    db.refresh(target)
    return {"slots": [serialize_slot(slot), serialize_slot(target)]}


@router.post("/slots/{slot_id}/attendance-session")
def open_slot_attendance(slot_id: str, date: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    slot = db.get(TimetableSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found.")
    if slot.is_cancelled:
        raise HTTPException(status_code=409, detail="This class is cancelled and cannot take attendance.")
    date_str = date or datetime.now().strftime("%Y-%m-%d")
    if db.query(Holiday).filter(Holiday.date == date_str).first():
        raise HTTPException(status_code=409, detail="Attendance cannot be opened on a registered holiday.")
    existing = db.query(AttendanceSession).filter(AttendanceSession.timetable_slot_id == slot.id, AttendanceSession.date == date_str).first()
    if existing:
        session = existing
    else:
        session = AttendanceService.get_or_create_session(db, slot.class_id, date_str, slot.period.start_time, f"{slot.subject.code} — {slot.subject.name}", user.id)
        session.timetable_slot_id = slot.id
        db.commit()
        db.refresh(session)
    return {"id": session.id, "class_id": session.class_id, "class_name": session.classroom.name if session.classroom else "Class", "date": session.date, "time": session.time, "title": session.title, "status": session.status, "present_count": sum(1 for r in session.records if r.status == "present"), "late_count": sum(1 for r in session.records if r.status == "late"), "absent_count": sum(1 for r in session.records if r.status == "absent"), "total_students": len(session.classroom.students) if session.classroom else 0, "created_at": session.created_at}
