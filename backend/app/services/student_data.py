"""Normalization, encrypted sensitive fields, and server-side import validation."""
import base64
import csv
import hashlib
import io
import json
import re
from typing import Any

from cryptography.fernet import Fernet

from app.config import settings

SENSITIVE_FIELDS = {"phone", "guardian_name", "guardian_phone", "guardian_email", "address"}
STANDARD_FIELDS = {"roll_number", "name", "email", "class_name", "section", "course", "year", "gender", "date_of_birth", "department", "batch", "blood_group", "admission_date", "status", *SENSITIVE_FIELDS}
ALIASES = {
    "student id": "roll_number", "student_id": "roll_number", "roll no": "roll_number", "roll number": "roll_number", "roll_no": "roll_number",
    "full name": "name", "student name": "name", "name": "name", "class": "class_name", "class/course": "class_name",
    "semester": "year", "year/semester": "year", "date of birth": "date_of_birth", "dob": "date_of_birth",
    "phone number": "phone", "mobile": "phone", "guardian phone": "guardian_phone", "guardian email": "guardian_email",
}

def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)

def encrypt_sensitive(value: dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(value).encode()).decode()

def decrypt_sensitive(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        return json.loads(_fernet().decrypt(value.encode()).decode())
    except Exception:
        return {}

def normalize_email(value: Any) -> str | None:
    value = str(value or "").strip().lower()
    return value or None

def normalize_phone(value: Any) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return f"+91{digits}" if len(digits) == 10 else (str(value).strip() or None)

def mapping_for_headers(headers: list[str]) -> dict[str, str]:
    return {header: ALIASES.get(header.strip().lower(), header.strip().lower().replace(" ", "_")) for header in headers}

def parse_tabular_file(filename: str, content: bytes) -> tuple[list[str], list[dict[str, Any]]]:
    if filename.lower().endswith((".xlsx", ".xls")):
        from openpyxl import load_workbook
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = workbook.active
        values = list(sheet.iter_rows(values_only=True))
        headers = [str(item or "").strip() for item in values[0]] if values else []
        return headers, [{headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))} for row in values[1:] if any(cell not in (None, "") for cell in row)]
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    return reader.fieldnames or [], list(reader)

def validate_rows(rows: list[dict[str, Any]], mapping: dict[str, str], existing_rolls: set[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    good, problems, seen = [], [], set()
    for row_number, raw in enumerate(rows, start=2):
        row = {mapping.get(key, key): ("" if value is None else str(value).strip()) for key, value in raw.items()}
        row["roll_number"] = row.get("roll_number", "").upper()
        row["name"] = row.get("name", "").strip()
        row["email"] = normalize_email(row.get("email"))
        row["phone"] = normalize_phone(row.get("phone"))
        errors = []
        if not row["roll_number"]: errors.append("Missing Student ID / roll number")
        if not row["name"]: errors.append("Missing full name")
        if not row.get("class_name"): errors.append("Missing class/course")
        if not row.get("section"): errors.append("Missing section")
        if row["roll_number"] in existing_rolls: errors.append("Duplicate: roll number already exists")
        if row["roll_number"] in seen: errors.append("Duplicate: roll number repeated in this file")
        if row["email"] and ("@" not in row["email"] or row["email"].startswith("@")): errors.append("Invalid email")
        if row["phone"] and not re.fullmatch(r"\+91\d{10}", row["phone"]): errors.append("Phone needs a valid 10-digit Indian number")
        seen.add(row["roll_number"])
        (problems if errors else good).append({"row": row_number, "data": row, "errors": errors})
    return good, problems
