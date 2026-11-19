"""add timetable domain

Revision ID: 6b7e8d9f0a11
Revises: 283bcb0339d5
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "6b7e8d9f0a11"
down_revision: Union[str, Sequence[str], None] = "283bcb0339d5"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Existing development databases may have created these tables via SQLAlchemy
    # metadata before Alembic was repaired. Keep this migration safely resumable.
    inspector = sa.inspect(op.get_bind())
    existing = set(inspector.get_table_names())
    if "subjects" not in existing:
        op.create_table("subjects", sa.Column("id", sa.String(), primary_key=True), sa.Column("code", sa.String(), nullable=False), sa.Column("name", sa.String(), nullable=False), sa.Column("color", sa.String(), nullable=False), sa.Column("periods_per_week", sa.Integer(), nullable=False), sa.Column("is_heavy", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=True), sa.UniqueConstraint("code"))
        op.create_index("ix_subjects_code", "subjects", ["code"])
    if "rooms" not in existing:
        op.create_table("rooms", sa.Column("id", sa.String(), primary_key=True), sa.Column("name", sa.String(), nullable=False), sa.Column("capacity", sa.Integer(), nullable=True), sa.Column("created_at", sa.DateTime(), nullable=True), sa.UniqueConstraint("name"))
        op.create_index("ix_rooms_name", "rooms", ["name"])
    if "periods" not in existing:
        op.create_table("periods", sa.Column("id", sa.String(), primary_key=True), sa.Column("label", sa.String(), nullable=False), sa.Column("start_time", sa.String(), nullable=False), sa.Column("end_time", sa.String(), nullable=False), sa.Column("order_index", sa.Integer(), nullable=False), sa.Column("is_break", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=True), sa.UniqueConstraint("order_index"))
    if "holidays" not in existing:
        op.create_table("holidays", sa.Column("id", sa.String(), primary_key=True), sa.Column("date", sa.String(), nullable=False), sa.Column("name", sa.String(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=True), sa.UniqueConstraint("date"))
        op.create_index("ix_holidays_date", "holidays", ["date"])
    if "timetable_slots" not in existing:
        op.create_table("timetable_slots", sa.Column("id", sa.String(), primary_key=True), sa.Column("class_id", sa.String(), nullable=False), sa.Column("subject_id", sa.String(), nullable=False), sa.Column("teacher_id", sa.String(), nullable=True), sa.Column("room_id", sa.String(), nullable=True), sa.Column("period_id", sa.String(), nullable=False), sa.Column("day_of_week", sa.Integer(), nullable=False), sa.Column("slot_type", sa.String(), nullable=False), sa.Column("notes", sa.Text(), nullable=True), sa.Column("is_cancelled", sa.Boolean(), nullable=False), sa.Column("substitute_teacher_id", sa.String(), nullable=True), sa.Column("created_at", sa.DateTime(), nullable=True), sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]), sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="SET NULL"), sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="SET NULL"), sa.ForeignKeyConstraint(["period_id"], ["periods.id"]), sa.ForeignKeyConstraint(["substitute_teacher_id"], ["users.id"], ondelete="SET NULL"))
        for name, column in [("ix_timetable_slots_class_id", "class_id"), ("ix_timetable_slots_subject_id", "subject_id"), ("ix_timetable_slots_teacher_id", "teacher_id"), ("ix_timetable_slots_room_id", "room_id"), ("ix_timetable_slots_period_id", "period_id"), ("ix_timetable_slots_day_of_week", "day_of_week")]:
            op.create_index(name, "timetable_slots", [column])
    session_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("attendance_sessions")}
    if "timetable_slot_id" not in session_columns:
        op.add_column("attendance_sessions", sa.Column("timetable_slot_id", sa.String(), nullable=True))
        op.create_index("ix_attendance_sessions_timetable_slot_id", "attendance_sessions", ["timetable_slot_id"])
        if op.get_bind().dialect.name != "sqlite":
            op.create_foreign_key("fk_sessions_timetable_slot", "attendance_sessions", "timetable_slots", ["timetable_slot_id"], ["id"], ondelete="SET NULL")

def downgrade() -> None:
    op.drop_constraint("fk_sessions_timetable_slot", "attendance_sessions", type_="foreignkey")
    op.drop_index("ix_attendance_sessions_timetable_slot_id", table_name="attendance_sessions")
    op.drop_column("attendance_sessions", "timetable_slot_id")
    op.drop_table("timetable_slots")
    op.drop_table("holidays")
    op.drop_table("periods")
    op.drop_table("rooms")
    op.drop_table("subjects")
