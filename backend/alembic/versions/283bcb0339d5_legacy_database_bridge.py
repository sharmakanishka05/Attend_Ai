"""bridge an existing legacy database revision

This revision was present in deployed SQLite databases but its migration file was
not kept in source control. It intentionally performs no DDL: the legacy schema
already exists, and retaining the revision restores a valid upgrade path.

Revision ID: 283bcb0339d5
Revises: 4d95421a9c60
"""
from typing import Sequence, Union

revision: str = "283bcb0339d5"
down_revision: Union[str, Sequence[str], None] = "4d95421a9c60"
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
