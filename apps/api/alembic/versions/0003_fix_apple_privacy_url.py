from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

_OLD_URL = "https://www.apple.com/legal/privacy/"
_NEW_URL = "https://www.apple.com/legal/privacy/en-ww/"


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            UPDATE entities
            SET policy_urls = jsonb_set(
              COALESCE(policy_urls, '{}'::jsonb),
              '{privacy}',
              to_jsonb(CAST(:url AS text)),
              true
            ),
            updated_at = now()
            WHERE slug = 'apple'
            """
        ),
        {"url": _NEW_URL},
    )

    # Only rewrite user documents that never successfully produced a snapshot.
    conn.execute(
        sa.text(
            """
            UPDATE documents
            SET url = :url,
                status = 'active',
                next_check_at = now(),
                etag = NULL,
                last_modified = NULL
            WHERE entity_id = (SELECT id FROM entities WHERE slug = 'apple')
              AND doc_type = 'privacy'
              AND deleted_at IS NULL
              AND last_snapshot_id IS NULL
            """
        ),
        {"url": _NEW_URL},
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            UPDATE entities
            SET policy_urls = jsonb_set(
              COALESCE(policy_urls, '{}'::jsonb),
              '{privacy}',
              to_jsonb(CAST(:url AS text)),
              true
            ),
            updated_at = now()
            WHERE slug = 'apple'
            """
        ),
        {"url": _OLD_URL},
    )

    conn.execute(
        sa.text(
            """
            UPDATE documents
            SET url = :url,
                next_check_at = now(),
                etag = NULL,
                last_modified = NULL
            WHERE entity_id = (SELECT id FROM entities WHERE slug = 'apple')
              AND doc_type = 'privacy'
              AND deleted_at IS NULL
              AND last_snapshot_id IS NULL
            """
        ),
        {"url": _OLD_URL},
    )
