from __future__ import annotations

import json
import uuid
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _seed_entities_from_catalog()


def downgrade() -> None:
    return


def _seed_entities_from_catalog() -> None:
    repo_root = Path(__file__).resolve().parents[4]
    catalog_path = repo_root / "catalog.json"
    if not catalog_path.exists():
        return

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    conn = op.get_bind()

    for item in catalog:
        slug = item["slug"]
        name = item["name"]
        website_url = item["website_url"]
        category = item["category"]
        policy_urls = json.dumps(item.get("policy_urls") or {})

        conn.execute(
            sa.text(
                """
                INSERT INTO entities (
                  id, slug, name, website_url, category, policy_urls, created_at, updated_at
                )
                VALUES (
                  :id, :slug, :name, :website_url, :category,
                  CAST(:policy_urls AS jsonb), now(), now()
                )
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    website_url = EXCLUDED.website_url,
                    category = EXCLUDED.category,
                    policy_urls = EXCLUDED.policy_urls,
                    updated_at = now()
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "slug": slug,
                "name": name,
                "website_url": website_url,
                "category": category,
                "policy_urls": policy_urls,
            },
        )
