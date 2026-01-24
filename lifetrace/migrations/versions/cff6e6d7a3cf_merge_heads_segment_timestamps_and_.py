"""merge heads: segment_timestamps and optimized_extraction

Revision ID: cff6e6d7a3cf
Revises: 034079ad387f, add_optimized_extraction_001
Create Date: 2026-01-23 20:34:00.629399

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "cff6e6d7a3cf"
down_revision: Union[str, None] = ("034079ad387f", "add_optimized_extraction_001")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
