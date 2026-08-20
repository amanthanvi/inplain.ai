"""Address validation, IP pinning and the streaming size cap."""

from __future__ import annotations

import pytest

from inplain import net
from inplain.net import (
    MAX_BYTES,
    ROBOTS_PRODUCT_TOKEN,
    USER_AGENT,
    SizeCapExceeded,
    TransportError,
    UnsafeAddressError,
    prepare_target,
    read_capped,
    validate_addresses,
)

from .conftest import resolver_for


def test_one_identity_serves_both_purposes():
    # The token robots is evaluated against is a prefix of what origins see,
    # because it is derived from it. v0.2.0 shipped two different strings.
    assert USER_AGENT == "inplainbot/1.0 (+https://inplain.ai)"
    assert ROBOTS_PRODUCT_TOKEN == "inplainbot"
    assert USER_AGENT.startswith(ROBOTS_PRODUCT_TOKEN)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",  # loopback
        "10.0.0.5",  # RFC1918
        "192.168.1.1",
        "172.16.0.1",
        "169.254.169.254",  # cloud metadata
        "100.64.0.1",  # CGNAT — the range v0.2.0's hand-rolled list missed
        "100.127.255.254",  # CGNAT, top of the range
        "0.0.0.0",
        "::1",
        "fd00::1",  # unique local
        "fe80::1",  # link local
    ],
)
def test_non_global_addresses_are_refused(address):
    with pytest.raises(UnsafeAddressError):
        validate_addresses("evil.test", [address])


def test_cgnat_is_refused_end_to_end():
    resolver = resolver_for({"cgnat.test": ["100.64.12.9"]})
    with pytest.raises(UnsafeAddressError, match="100.64.12.9"):
        prepare_target("https://cgnat.test/policy", resolver)


def test_a_single_bad_address_condemns_the_host():
    # Fail closed: a name answering with both a public and a private address
    # is a rebinding vector, not a target.
    resolver = resolver_for({"mixed.test": ["93.184.216.34", "10.1.2.3"]})
    with pytest.raises(UnsafeAddressError):
        prepare_target("https://mixed.test/policy", resolver)


def test_no_addresses_is_refused():
    with pytest.raises(UnsafeAddressError):
        validate_addresses("void.test", [])


def test_dns_failure_is_a_transport_error():
    def resolver(host):
        raise OSError("nodename nor servname provided")

    with pytest.raises(TransportError):
        prepare_target("https://gone.test/policy", resolver)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/policy",
        "gopher://example.com/",
        "https://user:pw@example.com/policy",
        "https:///nohost",
    ],
)
def test_unusable_urls_are_refused(url):
    with pytest.raises(UnsafeAddressError):
        prepare_target(url, resolver_for())


def test_target_pins_the_ip_and_keeps_the_hostname():
    target = prepare_target("https://example.com/privacy?x=1", resolver_for())
    assert target.ip == "93.184.216.34"
    assert target.host == "example.com"
    assert target.host_header == "example.com"
    assert target.pinned_url == "https://93.184.216.34/privacy?x=1"


def test_target_keeps_a_non_default_port_in_url_and_host_header():
    target = prepare_target("http://example.com:8080/policy", resolver_for())
    assert target.host_header == "example.com:8080"
    assert target.pinned_url == "http://93.184.216.34:8080/policy"


def test_ipv6_targets_are_bracketed():
    resolver = resolver_for({"v6.test": ["2606:2800:220:1:248:1893:25c8:1946"]})
    target = prepare_target("https://v6.test/policy", resolver)
    assert target.pinned_url == "https://[2606:2800:220:1:248:1893:25c8:1946]/policy"


def test_root_path_is_normalised():
    target = prepare_target("https://example.com", resolver_for())
    assert target.pinned_url == "https://93.184.216.34/"


def test_https_adapter_carries_sni_and_http_does_not():
    # SNI and certificate matching must still see the real hostname while the
    # socket goes to the address we validated.
    https = net._PinnedAdapter(server_hostname="example.com")
    assert https.poolmanager.connection_pool_kw["server_hostname"] == "example.com"
    plain = net._PinnedAdapter(server_hostname=None)
    assert "server_hostname" not in plain.poolmanager.connection_pool_kw


class FakeStream:
    """Counts what was pulled, so 'aborts' can be told from 'buffers then checks'."""

    def __init__(self, chunks):
        self._chunks = list(chunks)
        self.produced = 0
        self.closed = False

    def iter_content(self, chunk_size):
        for chunk in self._chunks:
            self.produced += 1
            yield chunk

    def close(self):
        self.closed = True


def test_size_cap_aborts_mid_stream_and_closes():
    stream = FakeStream([b"x" * 100] * 100)
    with pytest.raises(SizeCapExceeded):
        read_capped(stream, max_bytes=250, chunk_bytes=100)
    assert stream.produced == 3  # stopped at the chunk that crossed the cap
    assert stream.closed


def test_body_under_the_cap_is_returned_whole():
    stream = FakeStream([b"ab", b"cd", b"", b"ef"])
    assert read_capped(stream, max_bytes=MAX_BYTES) == b"abcdef"
    assert stream.closed


def test_cap_is_exact():
    stream = FakeStream([b"1234567890"])
    assert read_capped(stream, max_bytes=10) == b"1234567890"
    with pytest.raises(SizeCapExceeded):
        read_capped(FakeStream([b"12345678901"]), max_bytes=10)
