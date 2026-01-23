"""test

Revision ID: 89b2a1f0af8b
Revises: add_file_path_001
Create Date: 2026-01-22 20:10:15.174044

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "89b2a1f0af8b"
down_revision: str | None = "add_file_path_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """简化索引/表结构，移除不再使用的表和索引。

    兼容已有数据库：在删除表/索引/字段前先检查是否存在，避免因缺失导致迁移失败。
    """
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    # 旧版本可能没有这些表，因此需要在删除前做存在性检查
    if "schedules" in existing_tables:
        op.drop_table("schedules")
    if "transcript_segments" in existing_tables:
        op.drop_table("transcript_segments")
    with op.batch_alter_table("activities", schema=None) as batch_op:
        batch_op.alter_column("event_count", existing_type=sa.INTEGER(), nullable=False)
        batch_op.drop_index(batch_op.f("idx_activities_end_time"))
        batch_op.drop_index(batch_op.f("idx_activities_start_time"))

    with op.batch_alter_table("activity_event_relations", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_activity_event_relations_activity_id"))
        batch_op.drop_index(batch_op.f("idx_activity_event_relations_event_id"))

    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_attachments_deleted_at"))
        batch_op.drop_index(batch_op.f("idx_attachments_file_hash"))

    with op.batch_alter_table("audio_recordings", schema=None) as batch_op:
        batch_op.alter_column("file_path", existing_type=sa.VARCHAR(length=500), nullable=False)
        batch_op.alter_column("file_size", existing_type=sa.INTEGER(), nullable=False)
        batch_op.alter_column("duration", existing_type=sa.FLOAT(), nullable=False)
        batch_op.alter_column(
            "status",
            existing_type=sa.VARCHAR(length=20),
            nullable=False,
            existing_server_default=sa.text("'recording'"),
        )
        batch_op.alter_column(
            "is_24x7",
            existing_type=sa.BOOLEAN(),
            nullable=False,
            existing_server_default=sa.text("'0'"),
        )
        batch_op.alter_column(
            "transcription_status",
            existing_type=sa.VARCHAR(length=20),
            nullable=False,
            existing_server_default=sa.text("'pending'"),
        )
        batch_op.drop_index(batch_op.f("idx_audio_recordings_deleted_at"))
        batch_op.drop_index(batch_op.f("idx_audio_recordings_start_time"))
        batch_op.drop_index(batch_op.f("idx_audio_recordings_status"))
        batch_op.drop_column("duration_seconds")
        batch_op.drop_column("summary_text")
        batch_op.drop_column("attachment_id")
        batch_op.drop_column("event_id")
        batch_op.drop_column("title")
        batch_op.drop_column("num_speakers")
        batch_op.drop_column("segment_id")
        batch_op.drop_column("transcript_text")
        batch_op.drop_column("extracted_todos")
        batch_op.drop_column("optimized_text")

    with op.batch_alter_table("chats", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_chats_session_id"))

    with op.batch_alter_table("events", schema=None) as batch_op:
        batch_op.alter_column("start_time", existing_type=sa.DATETIME(), nullable=False)
        batch_op.alter_column("status", existing_type=sa.VARCHAR(length=20), nullable=False)

    with op.batch_alter_table("journal_tag_relations", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_journal_tag_relations_journal_id"))
        batch_op.drop_index(batch_op.f("idx_journal_tag_relations_tag_id"))

    with op.batch_alter_table("journals", schema=None) as batch_op:
        batch_op.alter_column("user_notes", existing_type=sa.TEXT(), nullable=True)
        batch_op.alter_column("content_format", existing_type=sa.VARCHAR(length=20), nullable=False)
        batch_op.drop_index(batch_op.f("idx_journals_date"))
        batch_op.drop_index(batch_op.f("idx_journals_deleted_at"))

    with op.batch_alter_table("messages", schema=None) as batch_op:
        batch_op.alter_column("content", existing_type=sa.TEXT(), nullable=True)
        batch_op.drop_index(batch_op.f("idx_messages_chat_id"))

    with op.batch_alter_table("ocr_results", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_ocr_results_screenshot_id"))

    with op.batch_alter_table("screenshots", schema=None) as batch_op:
        batch_op.alter_column("file_deleted", existing_type=sa.BOOLEAN(), nullable=False)
        batch_op.alter_column("is_processed", existing_type=sa.BOOLEAN(), nullable=False)
        batch_op.drop_index(batch_op.f("idx_screenshots_app_name"))
        batch_op.drop_index(batch_op.f("idx_screenshots_created_at"))
        batch_op.drop_index(batch_op.f("idx_screenshots_event_id"))

    with op.batch_alter_table("tags", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_tags_deleted_at"))
        batch_op.drop_index(batch_op.f("idx_tags_tag_name_unique"))

    with op.batch_alter_table("todo_attachment_relations", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_todo_attachment_relations_attachment_id"))
        batch_op.drop_index(batch_op.f("idx_todo_attachment_relations_todo_id"))

    with op.batch_alter_table("todo_tag_relations", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_todo_tag_relations_tag_id"))
        batch_op.drop_index(batch_op.f("idx_todo_tag_relations_todo_id"))

    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.alter_column(
            "priority",
            existing_type=sa.VARCHAR(length=20),
            nullable=False,
            existing_server_default=sa.text("'none'"),
        )
        batch_op.alter_column(
            "order",
            existing_type=sa.INTEGER(),
            nullable=False,
            existing_server_default=sa.text("0"),
        )
        batch_op.drop_index(batch_op.f("idx_todos_deleted_at"))
        batch_op.drop_index(batch_op.f("idx_todos_order"))
        batch_op.drop_index(batch_op.f("idx_todos_parent_todo_id"))
        batch_op.drop_index(batch_op.f("idx_todos_priority"))
        batch_op.drop_index(batch_op.f("idx_todos_status"))

    with op.batch_alter_table("transcriptions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("idx_transcriptions_audio_recording_id"))
        batch_op.drop_index(batch_op.f("idx_transcriptions_extraction_status"))

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("transcriptions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("idx_transcriptions_extraction_status"), ["extraction_status"], unique=False
        )
        batch_op.create_index(
            batch_op.f("idx_transcriptions_audio_recording_id"),
            ["audio_recording_id"],
            unique=False,
        )

    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_todos_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("idx_todos_priority"), ["priority"], unique=False)
        batch_op.create_index(
            batch_op.f("idx_todos_parent_todo_id"), ["parent_todo_id"], unique=False
        )
        batch_op.create_index(batch_op.f("idx_todos_order"), ["order"], unique=False)
        batch_op.create_index(batch_op.f("idx_todos_deleted_at"), ["deleted_at"], unique=False)
        batch_op.alter_column(
            "order", existing_type=sa.INTEGER(), nullable=True, existing_server_default=sa.text("0")
        )
        batch_op.alter_column(
            "priority",
            existing_type=sa.VARCHAR(length=20),
            nullable=True,
            existing_server_default=sa.text("'none'"),
        )

    with op.batch_alter_table("todo_tag_relations", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("idx_todo_tag_relations_todo_id"), ["todo_id"], unique=False
        )
        batch_op.create_index(batch_op.f("idx_todo_tag_relations_tag_id"), ["tag_id"], unique=False)

    with op.batch_alter_table("todo_attachment_relations", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("idx_todo_attachment_relations_todo_id"), ["todo_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("idx_todo_attachment_relations_attachment_id"),
            ["attachment_id"],
            unique=False,
        )

    with op.batch_alter_table("tags", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_tags_tag_name_unique"), ["tag_name"], unique=1)
        batch_op.create_index(batch_op.f("idx_tags_deleted_at"), ["deleted_at"], unique=False)

    with op.batch_alter_table("screenshots", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_screenshots_event_id"), ["event_id"], unique=False)
        batch_op.create_index(
            batch_op.f("idx_screenshots_created_at"), ["created_at"], unique=False
        )
        batch_op.create_index(batch_op.f("idx_screenshots_app_name"), ["app_name"], unique=False)
        batch_op.alter_column("is_processed", existing_type=sa.BOOLEAN(), nullable=True)
        batch_op.alter_column("file_deleted", existing_type=sa.BOOLEAN(), nullable=True)

    with op.batch_alter_table("ocr_results", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("idx_ocr_results_screenshot_id"), ["screenshot_id"], unique=False
        )

    with op.batch_alter_table("messages", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_messages_chat_id"), ["chat_id"], unique=False)
        batch_op.alter_column("content", existing_type=sa.TEXT(), nullable=False)

    with op.batch_alter_table("journals", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_journals_deleted_at"), ["deleted_at"], unique=False)
        batch_op.create_index(batch_op.f("idx_journals_date"), ["date"], unique=False)
        batch_op.alter_column("content_format", existing_type=sa.VARCHAR(length=20), nullable=True)
        batch_op.alter_column("user_notes", existing_type=sa.TEXT(), nullable=False)

    with op.batch_alter_table("journal_tag_relations", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("idx_journal_tag_relations_tag_id"), ["tag_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("idx_journal_tag_relations_journal_id"), ["journal_id"], unique=False
        )

    with op.batch_alter_table("events", schema=None) as batch_op:
        batch_op.alter_column("status", existing_type=sa.VARCHAR(length=20), nullable=True)
        batch_op.alter_column("start_time", existing_type=sa.DATETIME(), nullable=True)

    with op.batch_alter_table("chats", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_chats_session_id"), ["session_id"], unique=False)

    with op.batch_alter_table("audio_recordings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("optimized_text", sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column("extracted_todos", sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column("transcript_text", sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column("segment_id", sa.VARCHAR(length=200), nullable=True))
        batch_op.add_column(sa.Column("num_speakers", sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column("title", sa.VARCHAR(length=500), nullable=True))
        batch_op.add_column(sa.Column("event_id", sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column("attachment_id", sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column("summary_text", sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column("duration_seconds", sa.INTEGER(), nullable=True))
        batch_op.create_index(batch_op.f("idx_audio_recordings_status"), ["status"], unique=False)
        batch_op.create_index(
            batch_op.f("idx_audio_recordings_start_time"), ["start_time"], unique=False
        )
        batch_op.create_index(
            batch_op.f("idx_audio_recordings_deleted_at"), ["deleted_at"], unique=False
        )
        batch_op.alter_column(
            "transcription_status",
            existing_type=sa.VARCHAR(length=20),
            nullable=True,
            existing_server_default=sa.text("'pending'"),
        )
        batch_op.alter_column(
            "is_24x7",
            existing_type=sa.BOOLEAN(),
            nullable=True,
            existing_server_default=sa.text("'0'"),
        )
        batch_op.alter_column(
            "status",
            existing_type=sa.VARCHAR(length=20),
            nullable=True,
            existing_server_default=sa.text("'recording'"),
        )
        batch_op.alter_column("duration", existing_type=sa.FLOAT(), nullable=True)
        batch_op.alter_column("file_size", existing_type=sa.INTEGER(), nullable=True)
        batch_op.alter_column("file_path", existing_type=sa.VARCHAR(length=500), nullable=True)

    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_attachments_file_hash"), ["file_hash"], unique=False)
        batch_op.create_index(
            batch_op.f("idx_attachments_deleted_at"), ["deleted_at"], unique=False
        )

    with op.batch_alter_table("activity_event_relations", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("idx_activity_event_relations_event_id"), ["event_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("idx_activity_event_relations_activity_id"), ["activity_id"], unique=False
        )

    with op.batch_alter_table("activities", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("idx_activities_start_time"), ["start_time"], unique=False)
        batch_op.create_index(batch_op.f("idx_activities_end_time"), ["end_time"], unique=False)
        batch_op.alter_column("event_count", existing_type=sa.INTEGER(), nullable=True)

    op.create_table(
        "transcript_segments",
        sa.Column("created_at", sa.DATETIME(), nullable=False),
        sa.Column("updated_at", sa.DATETIME(), nullable=False),
        sa.Column("deleted_at", sa.DATETIME(), nullable=True),
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("audio_recording_id", sa.INTEGER(), nullable=True),
        sa.Column("segment_id", sa.VARCHAR(length=200), nullable=False),
        sa.Column("timestamp", sa.DATETIME(), nullable=False),
        sa.Column("raw_text", sa.TEXT(), nullable=True),
        sa.Column("optimized_text", sa.TEXT(), nullable=True),
        sa.Column("audio_start", sa.INTEGER(), nullable=False),
        sa.Column("audio_end", sa.INTEGER(), nullable=False),
        sa.Column("audio_file_id", sa.VARCHAR(length=200), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "schedules",
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("title", sa.VARCHAR(length=200), nullable=False),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column("start_time", sa.DATETIME(), nullable=False),
        sa.Column("end_time", sa.DATETIME(), nullable=True),
        sa.Column("status", sa.VARCHAR(length=20), nullable=False),
        sa.Column("created_at", sa.DATETIME(), nullable=False),
        sa.Column("updated_at", sa.DATETIME(), nullable=False),
        sa.Column("deleted_at", sa.DATETIME(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    # ### end Alembic commands ###
