"""Re-sync entities with the revalidated catalog.

The catalog was validated against live sites again after ~5 months. Three
things changed:

- coinbase and etsy now return 403 to every request from a datacenter IP
  (Cloudflare / Akamai bot protection, fired on IP reputation before any
  JS runs). A headless browser does not help; only residential proxies
  would, which is out of scope. Neither company had a single fetchable
  document, so both are dropped.
- reddit moved its privacy policy to www.reddit.com, whose robots.txt is
  `Disallow: /`. We respect robots (FR-11), so that URL is removed. Its
  user agreement still resolves on redditinc.com and is kept.
- cloudflare, proton, wikimedia and shopify are added in their place, all
  verified 200 + robots-allow + >15k extracted characters.

Net: 32 companies, 56 URLs, 56/56 passing `make catalog-validate`.

Entities for dropped companies are deleted. ON DELETE CASCADE on
documents removes any tracked documents and their snapshots/diffs with
them, which is correct: the URLs are unfetchable, so any history is
frozen and misleading.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# Companies removed from catalog.json in this revision.
_REMOVED_SLUGS = ("coinbase", "etsy")


def upgrade() -> None:
    _seed_entities_from_catalog()
    _remove_dropped_entities()


def downgrade() -> None:
    # Re-seeding is idempotent and the dropped entities are gone from
    # catalog.json, so there is nothing meaningful to restore.
    return


def _remove_dropped_entities() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM entities WHERE slug = ANY(:slugs)"),
        {"slugs": list(_REMOVED_SLUGS)},
    )


def _seed_entities_from_catalog() -> None:
    repo_root = Path(__file__).resolve().parents[4]
    catalog_path = repo_root / "catalog.json"
    if not catalog_path.exists():
        return

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    conn = op.get_bind()

    for item in catalog:
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
                "slug": item["slug"],
                "name": item["name"],
                "website_url": item["website_url"],
                "category": item["category"],
                "policy_urls": json.dumps(item.get("policy_urls") or {}),
            },
        )
