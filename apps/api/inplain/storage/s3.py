from __future__ import annotations

import gzip
import io
import logging
from functools import lru_cache

import boto3
from botocore.config import Config

from inplain.settings import settings

logger = logging.getLogger(__name__)


def s3_is_configured() -> bool:
    return bool(settings.s3_bucket and settings.s3_access_key_id and settings.s3_secret_access_key)


def build_snapshot_raw_key(*, document_id: str, snapshot_id: str, content_type: str | None) -> str:
    prefix = (settings.s3_prefix or "").strip("/")
    base = f"snapshots/{document_id}/{snapshot_id}/raw"

    if content_type and "pdf" in content_type.lower():
        name = f"{base}.pdf.gz"
    else:
        name = f"{base}.html.gz"

    if prefix:
        return f"{prefix}/{name}"
    return name


def upload_snapshot_raw(
    *,
    document_id: str,
    snapshot_id: str,
    content_type: str | None,
    raw_bytes: bytes,
) -> str | None:
    if not s3_is_configured():
        return None

    key = build_snapshot_raw_key(
        document_id=document_id,
        snapshot_id=snapshot_id,
        content_type=content_type,
    )

    try:
        body = _gzip(raw_bytes)
        _s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=body,
            ContentEncoding="gzip",
            ContentType=content_type or "application/octet-stream",
        )
    except Exception:
        logger.exception("s3 upload failed key=%s", key)
        return None

    return key


def delete_object(*, key: str) -> None:
    if not s3_is_configured():
        return

    try:
        _s3_client().delete_object(Bucket=settings.s3_bucket, Key=key)
    except Exception:
        logger.exception("s3 delete failed key=%s", key)


def _gzip(data: bytes) -> bytes:
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as f:
        f.write(data)
    return buf.getvalue()


@lru_cache(maxsize=1)
def _s3_client():
    config_kwargs: dict = {}
    if settings.s3_force_path_style:
        config_kwargs["s3"] = {"addressing_style": "path"}

    client = boto3.client(
        "s3",
        region_name=settings.s3_region or None,
        endpoint_url=settings.s3_endpoint_url or None,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(**config_kwargs) if config_kwargs else None,
    )
    return client

