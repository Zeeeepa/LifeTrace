"""merge_journal_uid_automation_20260204

Revision ID: merge_journal_uid_automation_20260204
Revises: b53d9b7c8e21, merge_automation_ical_001
Create Date: 2026-02-04

Merge heads for journal UID and automation/iCalendar.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "merge_journal_uid_automation_20260204"
down_revision: str | Sequence[str] | None = (
    "b53d9b7c8e21",
    "merge_automation_ical_001",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("SELECT 1")


def downgrade() -> None:
    op.execute("SELECT 1")
