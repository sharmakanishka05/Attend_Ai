"""add student data management module

Revision ID: 8d9e0f1a2b13
Revises: 7c8d9e0f1a12
"""
from alembic import op
import sqlalchemy as sa

revision = "8d9e0f1a2b13"
down_revision = "7c8d9e0f1a12"
branch_labels = None
depends_on = None

def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("students")}
    additions = [
        ("gender", sa.String()), ("date_of_birth", sa.String()), ("department", sa.String()),
        ("batch", sa.String()), ("blood_group", sa.String()), ("admission_date", sa.String()),
        ("sensitive_data", sa.Text()), ("custom_data", sa.Text()), ("deleted_at", sa.DateTime()),
        ("deleted_by_id", sa.String()), ("updated_at", sa.DateTime()),
    ]
    for name, column_type in additions:
        if name not in columns:
            op.add_column("students", sa.Column(name, column_type, nullable=True))
    if op.get_bind().dialect.name != "sqlite":
        op.create_foreign_key("fk_students_deleted_by", "students", "users", ["deleted_by_id"], ["id"])
    op.create_index("ix_students_deleted_at", "students", ["deleted_at"], if_not_exists=True)
    op.create_table("student_custom_fields", sa.Column("id", sa.String(), primary_key=True), sa.Column("key", sa.String(), nullable=False, unique=True), sa.Column("label", sa.String(), nullable=False), sa.Column("field_type", sa.String(), nullable=False), sa.Column("required", sa.Boolean(), nullable=False), sa.Column("options_json", sa.Text()), sa.Column("created_by_id", sa.String(), sa.ForeignKey("users.id")), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("student_import_jobs", sa.Column("id", sa.String(), primary_key=True), sa.Column("filename", sa.String(), nullable=False), sa.Column("source_type", sa.String(), nullable=False), sa.Column("status", sa.String(), nullable=False), sa.Column("imported_count", sa.Integer(), nullable=False), sa.Column("failed_count", sa.Integer(), nullable=False), sa.Column("payload_json", sa.Text()), sa.Column("created_by_id", sa.String(), sa.ForeignKey("users.id")), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("rolled_back_at", sa.DateTime()), sa.Column("rolled_back_by_id", sa.String(), sa.ForeignKey("users.id")))
    op.create_table("student_versions", sa.Column("id", sa.String(), primary_key=True), sa.Column("student_id", sa.String(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False), sa.Column("changed_by_id", sa.String(), sa.ForeignKey("users.id")), sa.Column("action", sa.String(), nullable=False), sa.Column("snapshot_json", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))

def downgrade() -> None:
    op.drop_table("student_versions")
    op.drop_table("student_import_jobs")
    op.drop_table("student_custom_fields")
