export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'teacher';
  is_active: boolean;
}

export interface Student {
  id: string;
  name: string;
  roll_number: string;
  email?: string;
  class_name: string;
  section: string;
  course?: string;
  year?: string;
  status: string;
  has_face_data: boolean;
  profile_photo_base64?: string | null;
  face_quality_score?: number | null;
  attendance_rate: number;
  created_at: string;
  gender?: string | null;
  date_of_birth?: string | null;
  department?: string | null;
  batch?: string | null;
  blood_group?: string | null;
  admission_date?: string | null;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  address?: string | null;
  custom_data?: Record<string, string>;
  deleted_at?: string | null;
}

export interface StudentImportPreview {
  filename: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  proposed_mapping: Record<string, string>;
  preview: Array<{ row: number; data: Record<string, string>; errors: string[] }>;
  valid_count: number;
  error_count: number;
  errors: Array<{ row: number; data: Record<string, string>; errors: string[] }>;
  required_fields: string[];
}

export interface EnrollmentImageInfo {
  id: string;
  label: string;
  thumbnail_base64?: string;
  quality_score?: number;
  is_primary?: boolean;
  model_name?: string;
  model_version?: string;
  created_at?: string;
}

export interface StudentDetail extends Student {
  embeddings_count: number;
  biometric_model?: string;
  embedding_dimension?: number;
  biometric_status?: string;
  enrollment_images?: EnrollmentImageInfo[];
  stats: {
    present: number;
    late: number;
    absent: number;
    total: number;
    rate: number;
  };
  history: Array<{
    id: string;
    session_title: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    confidence: number;
    marked_method: string;
    marked_at: string;
  }>;
}

export interface ClassModel {
  id: string;
  name: string;
  course: string;
  section: string;
  teacher_name: string;
  schedule?: string;
  student_count: number;
  created_at: string;
}

export interface BoundingBox {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface DetectedFace {
  box_id: string;
  bbox: BoundingBox;
  student_id?: string | null;
  student_name?: string | null;
  roll_number?: string | null;
  confidence: number;
  status: 'recognized' | 'review' | 'unknown';
  face_crop_base64?: string;
}

export interface ProcessImageResult {
  total_detected: number;
  recognized_count: number;
  review_count: number;
  unknown_count: number;
  faces: DetectedFace[];
  processed_image_data?: string;
}

export interface LiveFaceResult {
  box_id: string;
  bbox: BoundingBox;
  student_id?: string | null;
  student_name?: string | null;
  roll_number?: string | null;
  confidence: number;
  status: 'recognized' | 'review' | 'unknown';
  attendance_marked: boolean;
  attendance_status?: string;
  reason?: string | null;
  record_id?: string | null;
  face_crop_base64?: string;
}

export interface RecognizeAndMarkResult {
  face_detected: boolean;
  recognized: boolean;
  student_id?: string | null;
  student_name?: string | null;
  confidence: number;
  match_threshold: number;
  attendance_marked: boolean;
  reason?: string | null;
  session_id?: string | null;
  record_id?: string | null;
  timestamp?: string;
  total_detected?: number;
  faces?: LiveFaceResult[];
}

export interface AttendanceItem {
  student_id: string;
  student_name: string;
  roll_number: string;
  status: 'present' | 'absent' | 'late';
  confidence: number;
  marked_method: string;
  is_modified?: boolean;
  correction_reason?: string;
  face_crop_base64?: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  class_name?: string;
  date: string;
  time: string;
  title: string;
  status: 'active' | 'completed' | 'cancelled';
  present_count: number;
  absent_count: number;
  late_count: number;
  total_students: number;
  created_at: string;
}

export interface AttendanceReportSummary {
  attendance_rate: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_records: number;
  classes_today: number;
  trend: Array<{
    date: string;
    label: string;
    rate: number;
    present: number;
    absent: number;
    total: number;
  }>;
  class_comparisons: Array<{
    class_id: string;
    name: string;
    student_count: number;
    attendance_rate: number;
  }>;
}

export interface AuditLogItem {
  id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  timestamp: string;
}

export interface QualityFeedback {
  overall_pass: boolean;
  score: number;
  feedback: string[];
  checks: {
    good_lighting: boolean;
    clearly_visible: boolean;
    face_centered: boolean;
    sharpness: boolean;
  };
}

export interface TimetableSubject {
  id: string;
  code: string;
  name: string;
  color: string;
  periods_per_week: number;
  is_heavy: boolean;
}

export interface TimetableRoom { id: string; name: string; capacity?: number | null; }
export interface TimetablePeriod { id: string; label: string; start_time: string; end_time: string; order_index: number; is_break: boolean; }
export interface TimetableTeacher { id: string; name: string; }
export interface TimetableHoliday { id: string; date: string; name: string; }
export interface TimetableSlot {
  id: string; class_id: string; class_name: string; subject_id: string; subject_code: string;
  subject_name: string; color: string; teacher_id?: string | null; teacher_name: string;
  room_id?: string | null; room_name: string; period_id: string; period_label: string;
  start_time: string; end_time: string; day_of_week: number; slot_type: "lecture" | "lab" | "tutorial";
  notes?: string | null; is_cancelled: boolean; substitute_teacher_id?: string | null;
  substitute_teacher_name?: string | null;
}

export interface TimetableCatalog {
  classes: Array<{ id: string; name: string; section: string; course: string; teacher_id?: string | null; teacher_name: string }>;
  subjects: TimetableSubject[];
  rooms: TimetableRoom[];
  periods: TimetablePeriod[];
  teachers: TimetableTeacher[];
  holidays: TimetableHoliday[];
  metadata?: Record<string, string>;
}
