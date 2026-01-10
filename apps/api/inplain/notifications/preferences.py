from __future__ import annotations

from dataclasses import dataclass

from inplain.db.models.enums import EmailMode


@dataclass(frozen=True)
class EffectiveEmailPreference:
    email_enabled: bool
    email_mode: EmailMode


def compute_effective_email_preference(
    *,
    global_pref: EffectiveEmailPreference | None,
    document_pref: EffectiveEmailPreference | None,
) -> EffectiveEmailPreference:
    if global_pref is not None and global_pref.email_enabled is False:
        return EffectiveEmailPreference(email_enabled=False, email_mode=EmailMode.immediate)

    if document_pref is not None:
        return document_pref

    if global_pref is not None:
        return global_pref

    return EffectiveEmailPreference(email_enabled=True, email_mode=EmailMode.immediate)
