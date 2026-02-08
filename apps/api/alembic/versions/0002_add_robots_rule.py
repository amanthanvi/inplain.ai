from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("robots_rule", sa.Text(), nullable=True))

    op.drop_index("ix_documents_next_check_at_active", table_name="documents")
    op.create_index(
        "ix_documents_next_check_at_schedulable",
        "documents",
        ["next_check_at"],
        postgresql_where=sa.text(
            "status IN ('active','blocked_robots','error') AND deleted_at IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_documents_next_check_at_schedulable", table_name="documents")
    op.create_index(
        "ix_documents_next_check_at_active",
        "documents",
        ["next_check_at"],
        postgresql_where=sa.text("status = 'active' AND deleted_at IS NULL"),
    )

    op.drop_column("documents", "robots_rule")
