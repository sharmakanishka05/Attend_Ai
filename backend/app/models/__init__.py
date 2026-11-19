from datetime import datetime
import uuid
import json
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, Table
)
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

# Association table for Class and Student
class_students = Table(
    "class_students",
    Base.metadata,
    Column("class_id", String, ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", String, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="teacher")  # "admin" or "teacher"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sessions = relationship("AttendanceSession", back_populates="creator")
    corrections = relationship("AttendanceCorrection", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, index=True)
    roll_number = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    class_name = Column(String, nullable=False)
    section = Column(String, nullable=False)
    course = Column(String, nullable=True)
    year = Column(String, nullable=True)
    dataset_type = Column(String, default="PRODUCTION", nullable=False, index=True)  # "PRODUCTION" or "TEST_DATA"
    status = Column(String, default="active")  # "active" or "inactive"
    gender = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    department = Column(String, nullable=True)
    batch = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    admission_date = Column(String, nullable=True)
    sensitive_data = Column(Text, nullable=True)  # encrypted JSON: phone, guardian and address details
    custom_data = Column(Text, nullable=True, default="{}")
    deleted_at = Column(DateTime, nullable=True, index=True)
    deleted_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classes = relationship("ClassModel", secondary=class_students, back_populates="students")
    face_embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
    deleted_by = relationship("User", foreign_keys=[deleted_by_id])
    versions = relationship("StudentVersion", back_populates="student", cascade="all, delete-orphan")

class ClassModel(Base):
    __tablename__ = "classes"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)  # e.g., "MCA Final Year"
    course = Column(String, nullable=False)  # e.g., "MCA"
    section = Column(String, nullable=False)  # e.g., "MCA Final Year"
    teacher_id = Column(String, ForeignKey("users.id"), nullable=True)
    teacher_name = Column(String, nullable=False, default="Unassigned")
    schedule = Column(String, nullable=True)  # e.g., "Mon-Fri 09:30 AM"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teacher = relationship("User", foreign_keys=[teacher_id])
    students = relationship("Student", secondary=class_students, back_populates="classes")
    sessions = relationship("AttendanceSession", back_populates="classroom", cascade="all, delete-orphan")
    timetable_slots = relationship("TimetableSlot", back_populates="classroom", cascade="all, delete-orphan")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#3157D5")
    periods_per_week = Column(Integer, nullable=False, default=1)
    is_heavy = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    timetable_slots = relationship("TimetableSlot", back_populates="subject")

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, unique=True, nullable=False, index=True)
    capacity = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    timetable_slots = relationship("TimetableSlot", back_populates="room")

class Period(Base):
    __tablename__ = "periods"

    id = Column(String, primary_key=True, default=generate_uuid)
    label = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False, unique=True)
    is_break = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    timetable_slots = relationship("TimetableSlot", back_populates="period")

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(String, primary_key=True, default=generate_uuid)
    date = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(String, primary_key=True, default=generate_uuid)
    class_id = Column(String, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    teacher_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    teacher_name = Column(String, nullable=True)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    period_id = Column(String, ForeignKey("periods.id", ondelete="RESTRICT"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False, index=True)
    slot_type = Column(String, nullable=False, default="lecture")
    notes = Column(Text, nullable=True)
    is_cancelled = Column(Boolean, nullable=False, default=False)
    substitute_teacher_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("ClassModel", back_populates="timetable_slots")
    subject = relationship("Subject", back_populates="timetable_slots")
    teacher = relationship("User", foreign_keys=[teacher_id])
    substitute_teacher = relationship("User", foreign_keys=[substitute_teacher_id])
    room = relationship("Room", back_populates="timetable_slots")
    period = relationship("Period", back_populates="timetable_slots")
    attendance_sessions = relationship("AttendanceSession", back_populates="timetable_slot")

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding_json = Column(Text, nullable=False)  # Serialized 512-d or 128-d float list
    photo_path = Column(String, nullable=True)
    image_type = Column(String, default="face_crop", nullable=True)
    dataset_type = Column(String, default="PRODUCTION", nullable=False, index=True)  # "PRODUCTION" or "TEST_DATA"
    model_name = Column(String, default="SFace ONNX", nullable=True)
    model_version = Column(String, default="1.0", nullable=True)
    quality_score = Column(Float, default=1.0)
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="face_embeddings")

    @property
    def image_path(self):
        return self.photo_path

    @image_path.setter
    def image_path(self, val):
        self.photo_path = val

    def get_vector(self):
        try:
            return json.loads(self.embedding_json)
        except Exception:
            return []

    def set_vector(self, vec):
        self.embedding_json = json.dumps(vec)

class FaceImage(Base):
    __tablename__ = "face_images"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    image_path = Column(String, nullable=False)
    image_type = Column(String, default="face_crop", nullable=False)
    dataset_type = Column(String, default="TEST_DATA", nullable=False, index=True)  # "PRODUCTION" or "TEST_DATA"
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", backref="face_images")

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    class_id = Column(String, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    time = Column(String, nullable=False)  # e.g. "09:00 AM"
    title = Column(String, nullable=False)  # e.g. "Computer Science - Section A"
    status = Column(String, default="active")  # "active", "completed", "cancelled"
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    timetable_slot_id = Column(String, ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship("ClassModel", back_populates="sessions")
    creator = relationship("User", back_populates="sessions")
    timetable_slot = relationship("TimetableSlot", back_populates="attendance_sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="present")  # "present", "absent", "late"
    confidence = Column(Float, default=1.0)
    marked_method = Column(String, default="ai_upload")  # "ai_camera", "ai_upload", "manual"
    dataset_type = Column(String, default="PRODUCTION", nullable=False, index=True)
    marked_at = Column(DateTime, default=datetime.utcnow)

    # Prevent duplicate attendance for the same student in the same session
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
    )

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")
    corrections = relationship("AttendanceCorrection", back_populates="record", cascade="all, delete-orphan")

class AttendanceCorrection(Base):
    __tablename__ = "attendance_corrections"

    id = Column(String, primary_key=True, default=generate_uuid)
    record_id = Column(String, ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False)
    changed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    old_status = Column(String, nullable=False)
    new_status = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    record = relationship("AttendanceRecord", back_populates="corrections")
    user = relationship("User", back_populates="corrections")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # e.g., "FACE_DATA_DELETED", "ATTENDANCE_CONFIRMED"
    entity_type = Column(String, nullable=False)  # "Student", "Session", "Record"
    entity_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")

class StudentCustomField(Base):
    __tablename__ = "student_custom_fields"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=False)
    field_type = Column(String, nullable=False, default="text")
    required = Column(Boolean, default=False)
    options_json = Column(Text, nullable=True)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class StudentImportJob(Base):
    __tablename__ = "student_import_jobs"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String, nullable=False)
    source_type = Column(String, nullable=False, default="csv")
    status = Column(String, nullable=False, default="committed")
    imported_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    payload_json = Column(Text, nullable=True)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    rolled_back_at = Column(DateTime, nullable=True)
    rolled_back_by_id = Column(String, ForeignKey("users.id"), nullable=True)

class StudentVersion(Base):
    __tablename__ = "student_versions"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    snapshot_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="versions")

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_id = Column(String, ForeignKey("users.id"), nullable=True)

    updated_by = relationship("User")
