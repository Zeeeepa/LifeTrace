"""add_text_hash_to_ocr_results

Revision ID: add_text_hash_to_ocr_results
Revises: 89b2a1f0af8b
Create Date: 2026-01-23 00:00:00.000000

为 ocr_results 表添加 text_hash 列和索引，并为已有数据回填哈希值。
"""

from collections.abc import Sequence

import hashlib

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_text_hash_to_ocr_results"
down_revision: str | None = "89b2a1f0af8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _normalize_text(text: str | None) -> str:
    if not text:
        return ""
    # 去掉首尾空白并压缩中间多余空白，保证哈希稳定
    return " ".join(text.strip().split())


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    columns = {col["name"] for col in inspector.get_columns("ocr_results")}

    # 添加 text_hash 列
    if "text_hash" not in columns:
        with op.batch_alter_table("ocr_results", schema=None) as batch_op:
            batch_op.add_column(sa.Column("text_hash", sa.String(length=64), nullable=True))

    # 为 text_hash 创建索引（如果不存在）
    indexes = {idx["name"] for idx in inspector.get_indexes("ocr_results")}
    index_name = "idx_ocr_results_text_hash"
    if index_name not in indexes:
        op.create_index(index_name, "ocr_results", ["text_hash"], unique=False)

    # 回填已有数据的 text_hash
    result = connection.execute(sa.text("SELECT id, text_content FROM ocr_results"))
    rows = result.mappings().all()

    for row in rows:
        normalized = _normalize_text(row["text_content"])
        if not normalized:
            text_hash = None
        else:
            text_hash = hashlib.md5(normalized.encode("utf-8")).hexdigest()

        connection.execute(
            sa.text("UPDATE ocr_results SET text_hash = :text_hash WHERE id = :id"),
            {"text_hash": text_hash, "id": row["id"]},
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    # 删除索引（如果存在）
    indexes = {idx["name"] for idx in inspector.get_indexes("ocr_results")}
    index_name = "idx_ocr_results_text_hash"
    if index_name in indexes:
        op.drop_index(index_name, table_name="ocr_results")

    # 删除 text_hash 列（如果存在）
    columns = {col["name"] for col in inspector.get_columns("ocr_results")}
    if "text_hash" in columns:
        with op.batch_alter_table("ocr_results", schema=None) as batch_op:
            batch_op.drop_column("text_hash")
