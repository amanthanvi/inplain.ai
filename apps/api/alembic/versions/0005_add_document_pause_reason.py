from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("pause_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "pause_reason")
