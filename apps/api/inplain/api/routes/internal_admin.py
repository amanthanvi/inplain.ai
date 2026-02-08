from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from inplain.api.deps import get_db, require_admin_role
from inplain.api.schemas import JobOut
from inplain.db.models.enums import JobStatus
from inplain.db.models.jobs import Job

router = APIRouter(tags=["internal.admin"])


@router.get("/admin/jobs", response_model=list[JobOut], dependencies=[Depends(require_admin_role)])
def list_jobs(db: Session = Depends(get_db)) -> list[JobOut]:
    jobs = list(db.execute(select(Job).order_by(Job.created_at.desc()).limit(200)).scalars().all())
    return [JobOut.model_validate(j, from_attributes=True) for j in jobs]


@router.post("/admin/jobs/{job_id}/retry", dependencies=[Depends(require_admin_role)])
def retry_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, bool]:
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(
            status=JobStatus.queued,
            run_at=datetime.now(UTC),
            locked_at=None,
            started_at=None,
            finished_at=None,
            error=None,
        )
    )
    db.commit()
    return {"ok": True}
