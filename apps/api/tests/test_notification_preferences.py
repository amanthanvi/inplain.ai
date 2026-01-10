from inplain.db.models.enums import EmailMode
from inplain.notifications.preferences import (
    EffectiveEmailPreference,
    compute_effective_email_preference,
)


def test_global_unsubscribe_overrides_document_pref() -> None:
    global_pref = EffectiveEmailPreference(email_enabled=False, email_mode=EmailMode.daily_digest)
    doc_pref = EffectiveEmailPreference(email_enabled=True, email_mode=EmailMode.daily_digest)
    effective = compute_effective_email_preference(global_pref=global_pref, document_pref=doc_pref)
    assert effective.email_enabled is False
    assert effective.email_mode == EmailMode.immediate


def test_document_pref_overrides_global_mode() -> None:
    global_pref = EffectiveEmailPreference(email_enabled=True, email_mode=EmailMode.immediate)
    doc_pref = EffectiveEmailPreference(email_enabled=True, email_mode=EmailMode.daily_digest)
    effective = compute_effective_email_preference(global_pref=global_pref, document_pref=doc_pref)
    assert effective.email_enabled is True
    assert effective.email_mode == EmailMode.daily_digest


def test_default_preference_is_immediate_enabled() -> None:
    effective = compute_effective_email_preference(global_pref=None, document_pref=None)
    assert effective.email_enabled is True
    assert effective.email_mode == EmailMode.immediate
