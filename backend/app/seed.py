import os
import json
from datetime import datetime
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.models import User, SystemSetting, Student
from app.services.kit_timetable import synchronize_kit_timetable

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Verified roster supplied by the KIT Kanpur class administrator.  It is
# intentionally idempotent: deployments fill in only missing roll numbers and
# never overwrite student-entered profile information.
KIT_MCA_SECTION_A_ROSTER = (
    ("250748", "Garhi Singh Rathore"),
    ("252132", "Aarif"),
    ("251221", "Shreya Rao"),
    ("250152", "Annu"),
    ("251342", "Varsha"),
    ("250853", "Arpit"),
    ("250927", "Anubhav Sahu"),
    ("251248", "Devanshi Dubey"),
    ("250936", "Siddharth Sharma"),
    ("252793", "Shashank Nath"),
    ("251571", "Anushriya Verma"),
    ("251574", "Ankita Prajapati"),
    ("MCA001", "Kanishka Sharma"),
    ("MCA002", "Namita Jain"),
    ("MCA003", "Akanksha Mishra"),
)

def seed_database(db: Session):
    # 1. Purge legacy placeholder accounts completely
    db.query(User).filter(User.email.in_(["alex.roberts@attendai.edu", "sarah.chen@attendai.edu"])).delete(synchronize_session=False)
    db.commit()

    # 2. Ensure the local administrator account.
    admin = db.query(User).filter(User.email == "ajeet.singh@kit.ac.in").first()
    if not admin:
        print("[KIT Kanpur] Creating the local administrator account and system settings...")
        admin = User(
            email="ajeet.singh@kit.ac.in",
            hashed_password=pwd_context.hash("password123"),
            full_name="Ajeet Singh",
            role="admin"
        )
        db.add(admin)
        db.commit()
    else:
        admin.full_name = "Ajeet Singh"
        admin.role = "admin"
        admin.hashed_password = pwd_context.hash("password123")
        db.commit()

    # 3. Bootstrap the real roster provided for this deployment. Missing rows
    # may safely be added on every startup; existing roster entries are left
    # untouched so imports and edits remain authoritative.
    roster_added = 0
    for roll_number, name in KIT_MCA_SECTION_A_ROSTER:
        if not db.query(Student).filter(Student.roll_number == roll_number).first():
            db.add(Student(
                name=name,
                roll_number=roll_number,
                class_name="Computer Network (BMC303)",
                section="A",
                course="MCA",
                year="3",
                department="Computer Applications",
                status="active",
                dataset_type="PRODUCTION",
            ))
            roster_added += 1
    db.commit()

    # 4. Persistent System Settings (idempotent check)
    s1 = db.query(SystemSetting).filter(SystemSetting.key == "FACE_MATCH_THRESHOLD").first()
    if not s1:
        setting1 = SystemSetting(
            key="FACE_MATCH_THRESHOLD",
            value="0.70",
            description="Minimum cosine similarity for high-confidence match",
            updated_by_id=admin.id
        )
        db.add(setting1)
    
    s2 = db.query(SystemSetting).filter(SystemSetting.key == "FACE_REVIEW_THRESHOLD").first()
    if not s2:
        setting2 = SystemSetting(
            key="FACE_REVIEW_THRESHOLD",
            value="0.52",
            description="Threshold below which face is classified as unknown",
            updated_by_id=admin.id
        )
        db.add(setting2)
    
    db.commit()
    timetable_repair = db.query(SystemSetting).filter(SystemSetting.key == "KIT_TIMETABLE_REPAIRED").first()
    result = synchronize_kit_timetable(db, repair_mismatched_slots=not timetable_repair)
    if not timetable_repair:
        db.add(SystemSetting(
            key="KIT_TIMETABLE_REPAIRED",
            value="true",
            description="One-time repair of the imported KIT Kanpur timetable.",
            updated_by_id=admin.id,
        ))
        db.commit()
    print(
        "[KIT Kanpur] Database initialized with administrator, system settings, and "
        f"{result['students_per_class']} students in each MCA Section A subject class "
        f"({roster_added} roster rows added; {result['slots_repaired']} schedule rows repaired)."
    )
