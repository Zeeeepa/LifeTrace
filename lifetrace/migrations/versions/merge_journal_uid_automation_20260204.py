"""merge_journal_uid_automation_20260204

Revision ID: merge_journal_uid_automation_20260204
Revises: add_automation_tasks_001
Create Date: 2026-02-04

Merge placeholder to bridge automation tasks with legacy journal UID work.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "merge_journal_uid_automation_20260204"
down_revision: str | None = "add_automation_tasks_001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Merge heads - no schema changes."""
    op.execute("SELECT 1")


def downgrade() -> None:
    """Merge heads - no schema changes."""
    op.execute("SELECT 1")
