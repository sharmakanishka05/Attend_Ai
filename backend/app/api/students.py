import os
import cv2
import json
import base64
import csv
import io
import numpy as np
from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import Student, FaceEmbedding, AttendanceRecord, AuditLog, ClassModel, StudentCustomField, StudentImportJob, StudentVersion, User
from app.schemas import StudentCreate, StudentUpdate, StudentResponse
from app.api.auth import require_admin, require_teacher_or_admin
from app.services.face_pipeline import face_pipeline
from app.services.quality_check import ImageQualityChecker
from app.config import settings
from app.services.student_data import STANDARD_FIELDS, SENSITIVE_FIELDS, decrypt_sensitive, encrypt_sensitive, mapping_for_headers, parse_tabular_file, validate_rows
from app.services.kit_timetable import enroll_student_in_kit_subjects

router = APIRouter(prefix="/students", tags=["students"])

def student_payload(student: Student, include_sensitive: bool = False) -> dict:
    records = student.attendance_records
    total = len(records)
    present = sum(1 for record in records if record.status in ["present", "late"])
    sensitive = decrypt_sensitive(student.sensitive_data) if include_sensitive else {}
    custom_data = json.loads(student.custom_data or "{}")
    profile_photo_base64 = None
    primary_face = next((face for face in student.face_embeddings if face.is_primary), student.face_embeddings[0] if student.face_embeddings else None)
    if primary_face and primary_face.photo_path and os.path.exists(primary_face.photo_path):
        try:
            with open(primary_face.photo_path, "rb") as profile_file:
                profile_photo_base64 = f"data:image/jpeg;base64,{base64.b64encode(profile_file.read()).decode('utf-8')}"
        except OSError:
            pass
    return {
        "id": student.id, "name": student.name, "roll_number": student.roll_number, "email": student.email,
        "class_name": student.class_name, "section": student.section, "course": student.course or student.class_name,
        "year": student.year or student.section, "dataset_type": student.dataset_type, "status": student.status,
        "gender": student.gender, "date_of_birth": student.date_of_birth, "department": student.department,
        "batch": student.batch, "blood_group": student.blood_group, "admission_date": student.admission_date,
        "phone": sensitive.get("phone") if include_sensitive else None,
        "guardian_name": sensitive.get("guardian_name") if include_sensitive else None,
        "guardian_phone": sensitive.get("guardian_phone") if include_sensitive else None,
        "guardian_email": sensitive.get("guardian_email") if include_sensitive else None,
        "address": sensitive.get("address") if include_sensitive else None,
        "custom_data": custom_data, "deleted_at": student.deleted_at,
        "has_face_data": len(student.face_embeddings) > 0,
        "profile_photo_base64": profile_photo_base64,
        "face_quality_score": max([face.quality_score for face in student.face_embeddings], default=None),
        "attendance_rate": round(present / total * 100, 1) if total else 0.0,
        "created_at": student.created_at,
    }

def record_version(db: Session, student: Student, user: User, action: str) -> None:
    db.add(StudentVersion(student_id=student.id, changed_by_id=user.id, action=action, snapshot_json=json.dumps(student_payload(student, include_sensitive=True), default=str)))

def apply_student_data(student: Student, values: dict[str, Any]) -> None:
    sensitive = decrypt_sensitive(student.sensitive_data)
    for key, value in values.items():
        if key in SENSITIVE_FIELDS and value is not None:
            sensitive[key] = value
        elif key == "custom_data" and value is not None:
            student.custom_data = json.dumps(value)
        elif hasattr(student, key) and value is not None:
            setattr(student, key, value)
    if sensitive:
        student.sensitive_data = encrypt_sensitive(sensitive)

@router.get("", response_model=List[StudentResponse])
def get_students(
    search: Optional[str] = None,
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    has_face: Optional[bool] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher_or_admin)
):
    query = db.query(Student)
    if not include_deleted:
        query = query.filter(Student.deleted_at.is_(None))
    if user.role == "teacher":
        allowed_class_ids = [item.id for item in db.query(ClassModel).filter(ClassModel.teacher_id == user.id).all()]
        query = query.filter(Student.classes.any(ClassModel.id.in_(allowed_class_ids)))

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter((Student.name.ilike(search_fmt)) | (Student.roll_number.ilike(search_fmt)))

    if class_name and class_name != "all":
        query = query.filter(Student.class_name == class_name)

    if section and section != "all":
        query = query.filter(Student.section == section)

    students = query.order_by(Student.roll_number.asc()).all()

    results = []
    for s in students:
        has_face_data = len(s.face_embeddings) > 0
        if has_face is not None and has_face != has_face_data:
            continue

        results.append(student_payload(s, include_sensitive=user.role == "admin"))

    return results

@router.post("", response_model=StudentResponse)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    # Check duplicate roll number
    existing = db.query(Student).filter(Student.roll_number == student_in.roll_number).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A student with roll number '{student_in.roll_number}' already exists."
        )

    student = Student(name=student_in.name, roll_number=student_in.roll_number, email=student_in.email, class_name=student_in.class_name, section=student_in.section, course=student_in.course or student_in.class_name, year=student_in.year or student_in.section, dataset_type=student_in.dataset_type or "PRODUCTION", status=student_in.status or "active")
    apply_student_data(student, student_in.model_dump(exclude_none=True))
    db.add(student)

    # Associate with class if exists
    classroom = db.query(ClassModel).filter(
        ClassModel.name == student_in.class_name,
        ClassModel.section == student_in.section
    ).first()
    if classroom:
        student.classes.append(classroom)
    enroll_student_in_kit_subjects(db, student)

    db.commit()
    db.refresh(student)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="STUDENT_CREATED",
        entity_type="Student",
        entity_id=student.id,
        details=f"Created student {student.name} ({student.roll_number}) in {student.class_name} - {student.section}"
    )
    db.add(audit)
    db.commit()

    record_version(db, student, user, "created")
    db.commit()
    return student_payload(student, include_sensitive=True)

@router.get("/template")
def download_student_template(user: User = Depends(require_admin)):
    headers = ["roll_number", "name", "email", "class_name", "section", "year", "department", "batch", "phone", "guardian_name", "guardian_phone", "admission_date", "status"]
    output = io.StringIO()
    csv.writer(output).writerow(headers)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=kit-student-import-template.csv"})

@router.post("/imports/preview")
async def preview_student_import(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload a CSV or Excel file.")
    headers, rows = parse_tabular_file(file.filename, await file.read())
    mapping = mapping_for_headers(headers)
    valid, errors = validate_rows(rows, mapping, {item[0] for item in db.query(Student.roll_number).all()})
    return {"filename": file.filename, "headers": headers, "rows": rows, "proposed_mapping": mapping, "preview": valid[:20], "valid_count": len(valid), "error_count": len(errors), "errors": errors[:100], "required_fields": ["roll_number", "name", "class_name", "section"]}

@router.post("/imports/commit")
def commit_student_import(payload: dict[str, Any], db: Session = Depends(get_db), user: User = Depends(require_admin)):
    rows, mapping = payload.get("rows", []), payload.get("mapping", {})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="No import rows supplied. Preview the file before committing it.")
    valid, errors = validate_rows(rows, mapping, {item[0] for item in db.query(Student.roll_number).all()})
    imported_ids = []
    for item in valid:
        row = item["data"]
        student = Student(name=row["name"], roll_number=row["roll_number"], email=row.get("email"), class_name=row["class_name"], section=row["section"], course=row.get("course") or row["class_name"], year=row.get("year") or row["section"], status=row.get("status") or "active")
        standard = {key: value for key, value in row.items() if key in STANDARD_FIELDS}
        custom = {key: value for key, value in row.items() if key not in STANDARD_FIELDS and value}
        standard["custom_data"] = custom
        apply_student_data(student, standard)
        classroom = db.query(ClassModel).filter(ClassModel.name == student.class_name, ClassModel.section == student.section).first()
        if classroom: student.classes.append(classroom)
        enroll_student_in_kit_subjects(db, student)
        db.add(student)
        db.flush()
        record_version(db, student, user, "imported")
        imported_ids.append(student.id)
    job = StudentImportJob(filename=payload.get("filename", "student-import.csv"), source_type=payload.get("source_type", "csv"), imported_count=len(imported_ids), failed_count=len(errors), payload_json=json.dumps({"student_ids": imported_ids, "errors": errors}), created_by_id=user.id)
    db.add(job)
    db.add(AuditLog(user_id=user.id, action="STUDENT_IMPORT_COMMITTED", entity_type="StudentImport", entity_id=job.id, details=f"Imported {len(imported_ids)} students; {len(errors)} rows need correction."))
    db.commit()
    return {"job_id": job.id, "imported_count": len(imported_ids), "failed_count": len(errors), "errors": errors}

@router.get("/imports")
def list_student_imports(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return [{"id": job.id, "filename": job.filename, "status": job.status, "imported_count": job.imported_count, "failed_count": job.failed_count, "created_at": job.created_at, "rolled_back_at": job.rolled_back_at} for job in db.query(StudentImportJob).order_by(StudentImportJob.created_at.desc()).limit(50).all()]

@router.post("/imports/{job_id}/rollback")
def rollback_student_import(job_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    job = db.get(StudentImportJob, job_id)
    if not job or job.status == "rolled_back":
        raise HTTPException(status_code=404, detail="An active import job was not found.")
    ids = json.loads(job.payload_json or "{}").get("student_ids", [])
    changed = db.query(Student).filter(Student.id.in_(ids)).update({Student.deleted_at: datetime.utcnow(), Student.deleted_by_id: user.id}, synchronize_session=False) if ids else 0
    job.status, job.rolled_back_at, job.rolled_back_by_id = "rolled_back", datetime.utcnow(), user.id
    db.add(AuditLog(user_id=user.id, action="STUDENT_IMPORT_ROLLED_BACK", entity_type="StudentImport", entity_id=job.id, details=f"Soft-deleted {changed} students imported by {job.filename}."))
    db.commit()
    return {"success": True, "restored": 0, "soft_deleted": changed}

@router.get("/custom-fields")
def list_custom_fields(db: Session = Depends(get_db), user: User = Depends(require_teacher_or_admin)):
    return [{"id": field.id, "key": field.key, "label": field.label, "field_type": field.field_type, "required": field.required, "options": json.loads(field.options_json or "[]")} for field in db.query(StudentCustomField).order_by(StudentCustomField.label).all()]

@router.post("/custom-fields")
def create_custom_field(payload: dict[str, Any], db: Session = Depends(get_db), user: User = Depends(require_admin)):
    key = str(payload.get("key") or "").strip().lower().replace(" ", "_")
    if not key or key in STANDARD_FIELDS or db.query(StudentCustomField).filter(StudentCustomField.key == key).first():
        raise HTTPException(status_code=400, detail="Use a unique custom field key that does not conflict with a standard student field.")
    field = StudentCustomField(key=key, label=str(payload.get("label") or key), field_type=str(payload.get("field_type") or "text"), required=bool(payload.get("required")), options_json=json.dumps(payload.get("options", [])), created_by_id=user.id)
    db.add(field); db.commit(); db.refresh(field)
    return {"id": field.id, "key": field.key, "label": field.label, "field_type": field.field_type, "required": field.required}

@router.put("/{id}")
def update_student(id: str, payload: StudentUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    student = db.query(Student).filter(Student.id == id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    values = payload.model_dump(exclude_unset=True)
    if "roll_number" in values and values["roll_number"] != student.roll_number:
        duplicate = db.query(Student).filter(Student.roll_number == values["roll_number"], Student.id != id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="A student with this roll number already exists.")
    record_version(db, student, user, "before_update")
    apply_student_data(student, values)
    db.add(AuditLog(user_id=user.id, action="STUDENT_UPDATED", entity_type="Student", entity_id=id, details=f"Updated student record for {student.name}."))
    db.commit(); db.refresh(student)
    return student_payload(student, include_sensitive=True)

@router.post("/{id}/restore")
def restore_student(id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    student = db.get(Student, id)
    if not student or not student.deleted_at:
        raise HTTPException(status_code=404, detail="A deleted student record was not found.")
    student.deleted_at, student.deleted_by_id = None, None
    record_version(db, student, user, "restored")
    db.add(AuditLog(user_id=user.id, action="STUDENT_RESTORED", entity_type="Student", entity_id=id, details=f"Restored student record for {student.name}."))
    db.commit()
    return {"success": True, "message": f"{student.name} restored."}

@router.get("/{id}")
def get_student_detail(
    id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher_or_admin)
):
    student = db.query(Student).filter(Student.id == id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == id).all()
    present_cnt = sum(1 for r in records if r.status == "present")
    late_cnt = sum(1 for r in records if r.status == "late")
    absent_cnt = sum(1 for r in records if r.status == "absent")
    total = len(records)
    rate = round(((present_cnt + late_cnt) / total * 100.0), 1) if total > 0 else 0.0

    history = []
    for r in sorted(records, key=lambda x: x.marked_at, reverse=True)[:15]:
        history.append({
            "id": r.id,
            "session_title": r.session.title if r.session else "Regular Class",
            "date": r.session.date if r.session else r.marked_at.strftime("%Y-%m-%d"),
            "status": r.status,
            "confidence": round(r.confidence, 3),
            "marked_method": r.marked_method,
            "marked_at": r.marked_at
        })

    has_face = len(student.face_embeddings) > 0
    enrollment_images = []
    for idx, emb in enumerate(student.face_embeddings):
        img_item = {
            "id": emb.id,
            "label": f"Image {idx + 1}",
            "quality_score": round(emb.quality_score or 1.0, 2),
            "is_primary": emb.is_primary,
            "model_name": emb.model_name or "SFace",
            "model_version": emb.model_version or "1.0",
            "created_at": emb.created_at.isoformat() if hasattr(emb.created_at, "isoformat") else str(emb.created_at)
        }
        if emb.photo_path and os.path.exists(emb.photo_path):
            try:
                with open(emb.photo_path, "rb") as pf:
                    b64 = base64.b64encode(pf.read()).decode("utf-8")
                    img_item["thumbnail_base64"] = f"data:image/jpeg;base64,{b64}"
            except Exception:
                pass
        enrollment_images.append(img_item)

    return {
        "id": student.id,
        "name": student.name,
        "roll_number": student.roll_number,
        "email": student.email,
        "class_name": student.class_name,
        "section": student.section,
        "course": getattr(student, "course", None) or student.class_name,
        "year": getattr(student, "year", None) or student.section,
        "dataset_type": getattr(student, "dataset_type", "PRODUCTION") or "PRODUCTION",
        "status": student.status,
        "has_face_data": has_face,
        "embeddings_count": len(student.face_embeddings),
        "biometric_model": "SFace",
        "embedding_dimension": 128,
        "biometric_status": "ENROLLED" if has_face else "NOT ENROLLED",
        "enrollment_images": enrollment_images,
        "created_at": student.created_at,
        "stats": {
            "present": present_cnt,
            "late": late_cnt,
            "absent": absent_cnt,
            "total": total,
            "rate": rate
        },
        "history": history
    }

@router.post("/{id}/face-registration")
async def register_student_face(
    id: str,
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Read image bytes
    if file:
        content = await file.read()
        np_arr = np.frombuffer(content, np.uint8)
        img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    elif image_base64:
        header, encoded = image_base64.split(",", 1) if "," in image_base64 else ("", image_base64)
        img_bytes = base64.b64decode(encoded)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    else:
        raise HTTPException(status_code=400, detail="No image file or base64 data provided.")

    if img_bgr is None or img_bgr.size == 0:
        raise HTTPException(status_code=400, detail="Invalid image format.")

    # 1. Detect face in the registration image
    detected = face_pipeline.detect_faces(img_bgr)
    if not detected:
        quality_feedback = ImageQualityChecker.evaluate_face_image(img_bgr)
        return {
            "success": False,
            "message": "No face detected in the photo. Please center your face under good lighting.",
            "quality": quality_feedback
        }

    # Use the primary/largest face
    primary_face = max(detected, key=lambda d: d["w_px"] * d["h_px"])
    bbox = (primary_face["x_px"], primary_face["y_px"], primary_face["w_px"], primary_face["h_px"])

    # 2. Quality Evaluation
    quality = ImageQualityChecker.evaluate_face_image(img_bgr, bbox)

    # 3. Crop face & extract 512-d ArcFace embedding
    x, y, w, h = bbox
    face_crop = img_bgr[y:y+h, x:x+w]
    embedding_vec = face_pipeline.extract_embedding(face_crop)

    # Save reference thumbnail securely in DATA_DIR
    photo_filename = f"face_{student.id}_{len(student.face_embeddings)+1}.jpg"
    photo_path = os.path.join(settings.DATA_DIR, "faces", photo_filename)
    cv2.imwrite(photo_path, cv2.resize(face_crop, (150, 150)))

    # Store embedding record
    new_embedding = FaceEmbedding(
        student_id=student.id,
        embedding_json=json.dumps(embedding_vec),
        photo_path=photo_path,
        quality_score=quality["score"],
        is_primary=True
    )
    db.add(new_embedding)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="FACE_REGISTERED",
        entity_type="Student",
        entity_id=student.id,
        details=f"Registered biometric face reference for {student.name}. Quality score: {quality['score']}"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": "Face registered successfully!",
        "quality": quality,
        "total_embeddings": len(student.face_embeddings)
    }

@router.delete("/{id}/face-data")
def delete_student_face_data(
    id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    """
    Privacy / GDPR compliance: Purges student biometric face data without wiping historical attendance records.
    Restricted to Administrators only.
    """
    student = db.query(Student).filter(Student.id == id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    count = len(student.face_embeddings)
    for emb in student.face_embeddings:
        if emb.photo_path and os.path.exists(emb.photo_path):
            try:
                os.remove(emb.photo_path)
            except Exception:
                pass
        db.delete(emb)

    audit = AuditLog(
        user_id=user.id,
        action="BIOMETRIC_DATA_PURGED",
        entity_type="Student",
        entity_id=student.id,
        details=f"Permanently purged {count} biometric face embeddings for student {student.name} ({student.roll_number})"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully deleted {count} face biometric records for {student.name}."
    }

@router.delete("/{id}")
def delete_student(
    id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    name = student.name
    roll = student.roll_number
    record_version(db, student, user, "soft_deleted")
    student.deleted_at = datetime.utcnow()
    student.deleted_by_id = user.id
    audit = AuditLog(
        user_id=user.id,
        action="STUDENT_SOFT_DELETED",
        entity_type="Student",
        entity_id=id,
        details=f"Soft-deleted student record for {name} ({roll})"
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": f"{name} moved to the recycle bin and can be restored."}
