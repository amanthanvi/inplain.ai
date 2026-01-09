import uuid

from inplain.notifications.unsubscribe import generate_unsubscribe_token, verify_unsubscribe_token


def test_unsubscribe_token_roundtrip() -> None:
    user_id = uuid.uuid4()
    token = generate_unsubscribe_token(user_id, secret="test-secret")
    assert verify_unsubscribe_token(token, secret="test-secret") == user_id


def test_unsubscribe_token_rejects_tamper() -> None:
    user_id = uuid.uuid4()
    token = generate_unsubscribe_token(user_id, secret="test-secret")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    assert verify_unsubscribe_token(tampered, secret="test-secret") is None

