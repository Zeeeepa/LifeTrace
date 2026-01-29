"""add_icalendar_fields_to_todos

Revision ID: d2f7a9c6b1a4
Revises: add_text_hash_to_ocr_results
Create Date: 2026-01-29 23:30:00.000000

为 todos 表添加 iCalendar 相关字段，并回填已有数据。
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2f7a9c6b1a4"
down_revision: str | None = "add_text_hash_to_ocr_results"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    columns = {col["name"] for col in inspector.get_columns("todos")}

    with op.batch_alter_table("todos", schema=None) as batch_op:
        if "uid" not in columns:
            batch_op.add_column(sa.Column("uid", sa.String(length=64), nullable=True))
        if "completed_at" not in columns:
            batch_op.add_column(sa.Column("completed_at", sa.DateTime(), nullable=True))
        if "percent_complete" not in columns:
            batch_op.add_column(sa.Column("percent_complete", sa.Integer(), nullable=True))
        if "rrule" not in columns:
            batch_op.add_column(sa.Column("rrule", sa.String(length=500), nullable=True))

    indexes = {idx["name"] for idx in inspector.get_indexes("todos")}
    if "idx_todos_uid" not in indexes:
        op.create_index("idx_todos_uid", "todos", ["uid"], unique=False)

    result = connection.execute(
        sa.text(
            "SELECT id, uid, status, completed_at, percent_complete, updated_at, created_at FROM todos"
        )
    )
    rows = result.mappings().all()

    for row in rows:
        updates: dict[str, object] = {}

        if not row["uid"]:
            updates["uid"] = str(uuid4())

        if row["percent_complete"] is None:
            updates["percent_complete"] = 100 if row["status"] == "completed" else 0

        if row["status"] == "completed" and row["completed_at"] is None:
            fallback = row["updated_at"] or row["created_at"]
            if isinstance(fallback, datetime):
                updates["completed_at"] = fallback

        if updates:
            updates["id"] = row["id"]
            sets = ", ".join([f"{key} = :{key}" for key in updates if key != "id"])
            connection.execute(
                sa.text(f"UPDATE todos SET {sets} WHERE id = :id"),
                updates,
            )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    indexes = {idx["name"] for idx in inspector.get_indexes("todos")}
    if "idx_todos_uid" in indexes:
        op.drop_index("idx_todos_uid", table_name="todos")

    columns = {col["name"] for col in inspector.get_columns("todos")}
    with op.batch_alter_table("todos", schema=None) as batch_op:
        if "rrule" in columns:
            batch_op.drop_column("rrule")
        if "percent_complete" in columns:
            batch_op.drop_column("percent_complete")
        if "completed_at" in columns:
            batch_op.drop_column("completed_at")
        if "uid" in columns:
            batch_op.drop_column("uid")
