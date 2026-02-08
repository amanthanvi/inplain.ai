from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

import inplain.db.models  # noqa: F401
from inplain.db.base import Base


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set (skipping integration tests)")
    return url


@pytest.fixture(scope="session")
def test_engine(test_database_url: str) -> Generator[Engine]:
    engine = create_engine(test_database_url, pool_pre_ping=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def db(test_engine: Engine) -> Generator[Session]:
    with test_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                "notifications, jobs, change_events, diffs, snapshots, documents, entities "
                "CASCADE"
            )
        )

    SessionLocal = sessionmaker(bind=test_engine, class_=Session, expire_on_commit=False)
    with SessionLocal() as session:
        yield session

