from __future__ import annotations

import json
import uuid
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "entities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("website_url", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column(
            "policy_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("uq_entities_slug", "entities", ["slug"], unique=True)

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column(
            "entity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column(
            "doc_type",
            sa.Enum(
                "privacy",
                "tos",
                "cookie",
                "other",
                name="document_doc_type",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "paused",
                "blocked_robots",
                "error",
                name="document_status",
                native_enum=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "schedule_tier",
            sa.Enum("daily", "6h", "1h", name="schedule_tier", native_enum=False),
            nullable=False,
            server_default="daily",
        ),
        sa.Column("next_check_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_snapshot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("etag", sa.Text(), nullable=True),
        sa.Column("last_modified", sa.Text(), nullable=True),
        sa.Column("robots_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "robots_status",
            sa.Enum("unknown", "allowed", "disallowed", name="robots_status", native_enum=False),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "uq_documents_user_entity_doc_type_active",
        "documents",
        ["clerk_user_id", "entity_id", "doc_type"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_documents_next_check_at_active",
        "documents",
        ["next_check_at"],
        postgresql_where=sa.text("status = 'active' AND deleted_at IS NULL"),
    )
    op.create_index(
        "ix_documents_clerk_user_id_status",
        "documents",
        ["clerk_user_id", "status"],
    )

    op.create_table(
        "snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fetch_method", sa.Text(), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("extracted_sha256", sa.Text(), nullable=False),
        sa.Column("extract_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("byte_size_extracted", sa.Integer(), nullable=False),
        sa.Column("retention_delete_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_snapshots_document_id_fetched_at",
        "snapshots",
        ["document_id", "fetched_at"],
    )
    op.create_index("ix_snapshots_retention_delete_at", "snapshots", ["retention_delete_at"])

    op.create_table(
        "diffs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "to_snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "diff_hunks",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("change_score", sa.Numeric(), nullable=False),
        sa.Column(
            "change_classification",
            sa.Enum(
                "cosmetic",
                "meaningful",
                "major",
                name="diff_classification",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "uq_diffs_from_to_snapshot",
        "diffs",
        ["from_snapshot_id", "to_snapshot_id"],
        unique=True,
    )
    op.create_index("ix_diffs_document_id_created_at", "diffs", ["document_id", "created_at"])

    op.create_table(
        "change_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "diff_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diffs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column(
            "summary_status",
            sa.Enum(
                "pending",
                "completed",
                "failed",
                "skipped_quota",
                name="summary_status",
                native_enum=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("summary_what_changed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("summary_why_matters", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("summary_model", sa.Text(), nullable=True),
        sa.Column("summary_prompt_version", sa.Integer(), nullable=True),
        sa.Column("summary_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_change_events_document_id_created_at",
        "change_events",
        ["document_id", "created_at"],
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "queue",
            sa.Enum(
                "fetch",
                "render",
                "diff",
                "summarize",
                "notify",
                "cleanup",
                name="job_queue",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("clerk_user_id", sa.Text(), nullable=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "running",
                "succeeded",
                "failed",
                "dead",
                name="job_status",
                native_enum=False,
            ),
            nullable=False,
            server_default="queued",
        ),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "run_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_jobs_queue_status_run_at",
        "jobs",
        ["queue", "status", "run_at"],
        postgresql_where=sa.text("status = 'queued'"),
    )
    op.create_index("ix_jobs_document_id_created_at", "jobs", ["document_id", "created_at"])
    op.create_index("ix_jobs_status_created_at", "jobs", ["status", "created_at"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "change_detected",
                "check_failed",
                "system",
                name="notification_type",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_notifications_clerk_user_id_created_at",
        "notifications",
        ["clerk_user_id", "created_at"],
    )
    op.create_index(
        "ix_notifications_clerk_user_id_unread",
        "notifications",
        ["clerk_user_id", "read_at"],
        postgresql_where=sa.text("read_at IS NULL"),
    )

    _seed_entities_from_catalog()


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("jobs")
    op.drop_table("change_events")
    op.drop_table("diffs")
    op.drop_table("snapshots")
    op.drop_table("documents")
    op.drop_table("entities")


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
