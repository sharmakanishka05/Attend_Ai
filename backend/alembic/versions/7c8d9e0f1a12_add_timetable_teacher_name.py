"""store a displayed instructor name for timetable slots

Revision ID: 7c8d9e0f1a12
Revises: 6b7e8d9f0a11
"""
from alembic import op
import sqlalchemy as sa

revision = "7c8d9e0f1a12"
down_revision = "6b7e8d9f0a11"
branch_labels = None
depends_on = None

def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("timetable_slots")}
    if "teacher_name" not in columns:
        op.add_column("timetable_slots", sa.Column("teacher_name", sa.String(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table("timetable_slots") as batch_op:
        batch_op.drop_column("teacher_name")
