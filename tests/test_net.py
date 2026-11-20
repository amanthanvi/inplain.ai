"""Address validation, IP pinning and the streaming size cap."""

from __future__ import annotations

import http.server
import shutil
import socket
import ssl
import subprocess
import threading
import tracemalloc

import pytest
import requests.adapters

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


def test_many_tiny_chunks_cost_the_cap_not_a_multiple_of_it():
    # Chunked encoding lets an origin send a 5 MiB body as millions of 2-byte
    # chunks. Held as a list, each costs ~40 bytes of object overhead, so the
    # cap would bound the payload but not the memory.
    class TinyChunks(FakeStream):
        def iter_content(self, chunk_size):
            for _ in range(10**6):
                yield bytes((97, 98))  # a fresh object each time, as off the wire

    cap = 1024 * 1024
    tracemalloc.start()
    try:
        assert len(read_capped(TinyChunks([]), max_bytes=4 * cap)) == 2 * 10**6
        with pytest.raises(SizeCapExceeded):
            read_capped(TinyChunks([]), max_bytes=cap)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    assert peak < 3 * 4 * cap  # buffer + its final copy, not 40 bytes a chunk


@pytest.mark.parametrize(
    "preamble",
    [
        b"",  # an endless chunk-size line
        b"1\r\nx\r\n0\r\n",  # a valid body, then an endless trailer line
    ],
)
def test_a_chunk_line_without_end_is_refused_without_buffering_it(preamble):
    # Lines of chunked framing are read by urllib3 before any body byte reaches
    # read_capped, so the cap cannot bound them; urllib3 >= 2.8.0 does
    # (GHSA-vxq7-64xx-v4gw). This holds the pin to that floor.
    flood = 32 * 1024 * 1024
    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]

    def serve():
        conn, _ = server.accept()
        try:
            conn.recv(65536)
            conn.sendall(
                b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n" + preamble
            )
            piece = b"a" * 65536  # hex digits, and never a line feed
            for _ in range(flood // len(piece)):
                conn.sendall(piece)
        except OSError:
            pass  # the client hung up, which is the point
        finally:
            conn.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    tracemalloc.start()
    try:
        with pytest.raises(TransportError, match="exceeded maximum"):
            net.PinnedTransport().get(_target(port), {}, 10, MAX_BYTES)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
        thread.join(10)
        server.close()
    assert peak < MAX_BYTES


def test_cap_is_exact():
    stream = FakeStream([b"1234567890"])
    assert read_capped(stream, max_bytes=10) == b"1234567890"
    with pytest.raises(SizeCapExceeded):
        read_capped(FakeStream([b"12345678901"]), max_bytes=10)


# ---------------------------------------------------------------------------
# PinnedTransport.get over loopback — the path the urllib3 pin exists for.
# prepare_target rightly refuses 127.0.0.1, so the Target is built by hand.


@pytest.fixture
def loopback():
    seen: list[tuple[str, str]] = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            seen.append((self.path, self.headers["Host"]))
            body = b"x" * 64
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("ETag", '"v1"')
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_address[1], seen
    server.shutdown()
    server.server_close()


def _target(port: int) -> net.Target:
    return net.Target(
        url=f"http://example.test:{port}/p?q=1",
        scheme="http",
        host="example.test",
        host_header=f"example.test:{port}",
        port=port,
        ip="127.0.0.1",
    )


def test_pinned_transport_connects_to_the_ip_and_sends_the_real_host(loopback):
    port, seen = loopback
    response = net.PinnedTransport().get(_target(port), {"User-Agent": USER_AGENT}, 5, 1000)
    assert seen == [("/p?q=1", f"example.test:{port}")]
    assert (response.status, response.body) == (200, b"x" * 64)
    assert response.url == f"http://example.test:{port}/p?q=1"
    assert response.headers["etag"] == '"v1"'  # case-insensitive as received


def test_pinned_transport_enforces_the_body_cap(loopback):
    port, _ = loopback
    with pytest.raises(SizeCapExceeded):
        net.PinnedTransport().get(_target(port), {}, 5, 63)


def test_pinned_transport_wraps_a_refused_connection():
    with socket.socket() as probe:  # a port nobody is listening on
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    with pytest.raises(TransportError):
        net.PinnedTransport().get(_target(port), {}, 5, 1000)


# ---------------------------------------------------------------------------
# The same over TLS: the reason for the urllib3 pin is that the socket goes to
# the pinned IP while SNI, certificate trust AND hostname matching use the
# real hostname. Certificates are throwaway, generated in tmp_path by the
# openssl CLI and never stored.

needs_openssl = pytest.mark.skipif(shutil.which("openssl") is None, reason="needs the openssl CLI")


def _openssl(*args: str) -> None:
    subprocess.run(["openssl", *args], check=True, capture_output=True)


def _ca(tmp_path) -> tuple[str, str]:
    cert, key = str(tmp_path / "ca.pem"), str(tmp_path / "ca.key")
    _openssl(
        "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-subj", "/CN=throwaway test CA", "-keyout", key, "-out", cert,
        "-addext", "basicConstraints=critical,CA:TRUE",
        "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    )
    return cert, key


def _leaf(tmp_path, name: str, ca: tuple[str, str]) -> tuple[str, str]:
    """A server certificate for ``name``, issued by ``ca``."""
    base = tmp_path / name
    ext = tmp_path / f"{name}.ext"
    ext.write_text(
        f"subjectAltName=DNS:{name}\nbasicConstraints=CA:FALSE\n"
        "keyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n"
        "authorityKeyIdentifier=keyid\n"
    )
    _openssl(
        "req", "-newkey", "rsa:2048", "-nodes", "-subj", f"/CN={name}",
        "-keyout", f"{base}.key", "-out", f"{base}.csr",
    )
    _openssl(
        "x509", "-req", "-in", f"{base}.csr", "-CA", ca[0], "-CAkey", ca[1],
        "-CAcreateserial", "-days", "1", "-extfile", str(ext), "-out", f"{base}.pem",
    )
    return f"{base}.pem", f"{base}.key"


@pytest.fixture
def tls_server():
    """Start an HTTPS loopback server presenting ``cert``; yields a starter
    returning (port, SNI names seen)."""
    servers = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *args):
            pass

    class Quiet(http.server.HTTPServer):
        def handle_error(self, request, client_address):
            pass  # the client aborts refused handshakes on purpose

    def start(cert: str, key: str) -> tuple[int, list[str | None]]:
        names: list[str | None] = []
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert, key)
        context.sni_callback = lambda sock, name, ctx: names.append(name)
        server = Quiet(("127.0.0.1", 0), Handler)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        servers.append(server)
        return server.server_address[1], names

    yield start
    for server in servers:
        server.shutdown()
        server.server_close()


def _https_target(port: int) -> net.Target:
    return net.Target(
        url=f"https://example.test:{port}/p",
        scheme="https",
        host="example.test",
        host_header=f"example.test:{port}",
        port=port,
        ip="127.0.0.1",
    )


@needs_openssl
def test_pinned_https_sends_the_real_name_as_sni_and_refuses_an_untrusted_certificate(
    tmp_path, tls_server
):
    ca = _ca(tmp_path)  # not trusted by the client here
    port, names = tls_server(*_leaf(tmp_path, "example.test", ca))
    with pytest.raises(TransportError):
        net.PinnedTransport().get(_https_target(port), {}, 5, 1000)
    assert names == ["example.test"]


@needs_openssl
def test_pinned_https_accepts_a_trusted_certificate_for_the_real_name(
    tmp_path, tls_server, monkeypatch
):
    ca = _ca(tmp_path)
    monkeypatch.setattr(requests.adapters, "DEFAULT_CA_BUNDLE_PATH", ca[0])
    port, names = tls_server(*_leaf(tmp_path, "example.test", ca))
    response = net.PinnedTransport().get(_https_target(port), {}, 5, 1000)
    assert (response.status, response.body) == (200, b"ok")
    assert names == ["example.test"]


@needs_openssl
def test_pinned_https_refuses_a_trusted_certificate_for_another_name(
    tmp_path, tls_server, monkeypatch
):
    """Trusted issuer, wrong name: only hostname matching can catch this."""
    ca = _ca(tmp_path)
    monkeypatch.setattr(requests.adapters, "DEFAULT_CA_BUNDLE_PATH", ca[0])
    port, _ = tls_server(*_leaf(tmp_path, "other.test", ca))
    with pytest.raises(TransportError, match="(?i)hostname|match"):
        net.PinnedTransport().get(_https_target(port), {}, 5, 1000)
