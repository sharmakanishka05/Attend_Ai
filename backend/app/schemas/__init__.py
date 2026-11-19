from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool

# --- Student Schemas ---
class StudentBase(BaseModel):
    name: str
    roll_number: str
    email: Optional[str] = None
    class_name: str
    section: str
    course: Optional[str] = None
    year: Optional[str] = None
    dataset_type: Optional[str] = "PRODUCTION"
    status: Optional[str] = "active"
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    blood_group: Optional[str] = None
    admission_date: Optional[str] = None
    phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[str] = None
    address: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None

    @field_validator("roll_number", mode="before")
    @classmethod
    def normalize_roll_number(cls, value):
        return str(value or "").strip().upper()

    @field_validator("email", "guardian_email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower() if value else None

    @field_validator("phone", "guardian_phone", mode="before")
    @classmethod
    def normalize_phone(cls, value):
        if not value:
            return None
        digits = re.sub(r"\D", "", str(value))
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        return f"+91{digits}" if len(digits) == 10 else str(value).strip()

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    roll_number: Optional[str] = None
    email: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    course: Optional[str] = None
    year: Optional[str] = None
    dataset_type: Optional[str] = None
    status: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    blood_group: Optional[str] = None
    admission_date: Optional[str] = None
    phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[str] = None
    address: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None

class StudentResponse(StudentBase):
    id: str
    has_face_data: bool = False
    face_quality_score: Optional[float] = None
    attendance_rate: float = 0.0
    profile_photo_base64: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RecognizeAndMarkResponse(BaseModel):
    face_detected: bool
    recognized: bool
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    confidence: float = 0.0
    match_threshold: float = 0.70
    attendance_marked: bool = False
    reason: Optional[str] = None
    session_id: Optional[str] = None
    record_id: Optional[str] = None
    timestamp: Optional[str] = None
    total_detected: Optional[int] = 0
    faces: Optional[List[Dict[str, Any]]] = None

# --- Class Schemas ---
class ClassCreate(BaseModel):
    name: str
    course: str
    section: str
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    schedule: Optional[str] = None

class ClassResponse(BaseModel):
    id: str
    name: str
    course: str
    section: str
    teacher_id: Optional[str] = None
    teacher_name: str
    schedule: Optional[str] = None
    student_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# --- Attendance & CV Schemas ---
class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float

class DetectedFace(BaseModel):
    box_id: str
    bbox: BoundingBox
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    confidence: float = 0.0
    status: str  # "recognized", "review", "unknown"
    face_crop_base64: Optional[str] = None

class ProcessImageResponse(BaseModel):
    total_detected: int
    recognized_count: int
    review_count: int
    unknown_count: int
    faces: List[DetectedFace]
    processed_image_data: Optional[str] = None

class AttendanceItem(BaseModel):
    student_id: str
    status: str  # "present", "absent", "late"
    confidence: float = 1.0
    marked_method: str = "ai_upload"

class ConfirmAttendanceRequest(BaseModel):
    session_id: str
    items: List[AttendanceItem]
    unknown_faces_handled: int = 0
    notes: Optional[str] = None

class AttendanceCorrectionRequest(BaseModel):
    record_id: str
    new_status: str  # "present", "absent", "late"
    reason: str

class AttendanceRecordResponse(BaseModel):
    id: str
    session_id: str
    student_id: str
    student_name: str
    roll_number: str
    status: str
    confidence: float
    marked_method: str
    marked_at: datetime

# --- Session Schemas ---
class SessionCreate(BaseModel):
    class_id: str
    date: str
    time: str
    title: str

# --- Timetable Schemas ---
class SubjectCreate(BaseModel):
    code: str
    name: str
    color: str = "#3157D5"
    periods_per_week: int = Field(default=1, ge=1, le=12)
    is_heavy: bool = False

class RoomCreate(BaseModel):
    name: str
    capacity: Optional[int] = Field(default=None, ge=1)

class PeriodCreate(BaseModel):
    label: str
    start_time: str
    end_time: str
    order_index: int = Field(ge=0)
    is_break: bool = False

class TimetableSlotCreate(BaseModel):
    class_id: str
    subject_id: str
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    room_id: Optional[str] = None
    period_id: str
    day_of_week: int = Field(ge=0, le=5)
    slot_type: str = "lecture"
    notes: Optional[str] = None

class TimetableSlotUpdate(BaseModel):
    class_id: Optional[str] = None
    subject_id: Optional[str] = None
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    room_id: Optional[str] = None
    period_id: Optional[str] = None
    day_of_week: Optional[int] = Field(default=None, ge=0, le=5)
    slot_type: Optional[str] = None
    notes: Optional[str] = None
    is_cancelled: Optional[bool] = None
    substitute_teacher_id: Optional[str] = None

class HolidayCreate(BaseModel):
    date: str
    name: str

class SessionResponse(BaseModel):
    id: str
    class_id: str
    class_name: Optional[str] = None
    date: str
    time: str
    title: str
    status: str
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    total_students: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# --- Reports & Audit Schemas ---
class AttendanceReportSummary(BaseModel):
    attendance_rate: float
    present_count: int
    absent_count: int
    late_count: int
    total_records: int
    classes_today: int
    trend: List[Dict[str, Any]]
    class_comparisons: List[Dict[str, Any]]

class AuditLogResponse(BaseModel):
    id: str
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime
