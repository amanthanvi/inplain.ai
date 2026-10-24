"""SSRF-safe, IP-pinned, size-capped HTTP transport.

Nothing in this module follows redirects. The caller drives the hop loop so
that address validation, robots.txt and politeness are re-evaluated on *every*
hop (SPEC §8, AC-6). Each request is made against an address we resolved
ourselves and connect to directly, with the ``Host`` header and TLS SNI still
carrying the real hostname, so the client cannot re-resolve behind our back.
"""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Protocol
from urllib.parse import urlsplit, urlunsplit

import requests
from requests.adapters import HTTPAdapter
from requests.structures import CaseInsensitiveDict

# One honest identity. It is what origins see, and the product token used to
# evaluate robots.txt is derived from it rather than written out a second time,
# so the two cannot drift apart (SPEC §8: v0.2.0's spoofed Chrome UA meant no
# origin could apply a rule to this crawler).
USER_AGENT = "inplainbot/1.0 (+https://inplain.ai)"
ROBOTS_PRODUCT_TOKEN = USER_AGENT.split("/", 1)[0]

DEFAULT_TIMEOUT = 30.0
MAX_BYTES = 5 * 1024 * 1024
CHUNK_BYTES = 64 * 1024
ALLOWED_SCHEMES = ("http", "https")
DEFAULT_PORTS = {"http": 80, "https": 443}


class FetchError(Exception):
    """A document could not be fetched. Reported and skipped, never fatal."""


class TransportError(FetchError):
    """The origin could not be reached, or spoke badly."""


class BlockedError(FetchError):
    """We refused to make (or continue) the request. Our rules, not theirs."""


class UnsafeAddressError(BlockedError):
    """The host does not resolve to a globally routable address."""


class SizeCapExceeded(FetchError):
    """The response body grew past the cap; the connection was dropped."""


@dataclass(frozen=True)
class Target:
    """A validated, resolved single-hop destination."""

    url: str  # the URL as requested, with its real hostname
    scheme: str
    host: str  # hostname only
    host_header: str  # hostname[:port] — what goes on the wire as Host
    port: int
    ip: str  # the address we pin the connection to

    @property
    def pinned_url(self) -> str:
        literal = f"[{self.ip}]" if ":" in self.ip else self.ip
        parts = urlsplit(self.url)
        netloc = literal
        if self.port != DEFAULT_PORTS[self.scheme]:
            netloc = f"{literal}:{self.port}"
        return urlunsplit((self.scheme, netloc, parts.path or "/", parts.query, ""))


@dataclass
class HttpResponse:
    """What one hop returned. The body is already read, under the cap."""

    url: str
    status: int
    headers: CaseInsensitiveDict = field(default_factory=CaseInsensitiveDict)
    body: bytes = b""


class Transport(Protocol):
    """The seam tests replace. Implementations perform exactly one hop."""

    def get(
        self,
        target: Target,
        headers: Mapping[str, str],
        timeout: float,
        max_bytes: int,
    ) -> HttpResponse: ...


def default_resolver(host: str) -> list[str]:
    """Resolve a hostname to every address it offers, in order."""
    infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


def _is_global(address: str) -> bool:
    # `is_global` is the whole predicate on purpose. A hand-rolled list of
    # private ranges is how v0.2.0 let CGNAT (100.64.0.0/10) through.
    return ipaddress.ip_address(address.partition("%")[0]).is_global


def validate_addresses(host: str, addresses: Iterable[str]) -> str:
    """Return the address to pin, or raise if *any* address is not global.

    Rejecting the whole host when one of its addresses is off-limits is the
    fail-closed reading: a name that answers with both a public and a private
    address is a rebinding vector, not a target.
    """
    resolved = list(addresses)
    if not resolved:
        raise UnsafeAddressError(f"{host} resolved to no addresses")
    for address in resolved:
        try:
            if not _is_global(address):
                raise UnsafeAddressError(
                    f"{host} resolves to non-global address {address}"
                )
        except ValueError as exc:
            raise UnsafeAddressError(f"{host} resolved to {address!r}: {exc}") from exc
    return resolved[0]


def prepare_target(url: str, resolver=default_resolver) -> Target:
    """Validate a URL and resolve it to a pinned, globally-routable address."""
    parts = urlsplit(url)
    if parts.scheme not in ALLOWED_SCHEMES:
        raise UnsafeAddressError(f"unsupported scheme in {url!r}")
    if parts.username or parts.password:
        raise UnsafeAddressError(f"credentials in URL are not accepted: {url!r}")
    host = parts.hostname
    if not host:
        raise UnsafeAddressError(f"no host in {url!r}")
    try:
        port = parts.port or DEFAULT_PORTS[parts.scheme]
    except ValueError as exc:
        raise UnsafeAddressError(f"bad port in {url!r}: {exc}") from exc
    try:
        addresses = list(resolver(host))
    except OSError as exc:
        raise TransportError(f"DNS resolution failed for {host}: {exc}") from exc
    ip = validate_addresses(host, addresses)
    return Target(
        url=url,
        scheme=parts.scheme,
        host=host,
        host_header=parts.netloc,
        port=port,
        ip=ip,
    )


def read_capped(response, max_bytes: int, chunk_bytes: int = CHUNK_BYTES) -> bytes:
    """Stream a body, aborting the moment it exceeds the cap.

    The cap is checked per chunk, never after buffering, and applies to
    decompressed bytes so a compression bomb hits it too.
    """
    chunks: list[bytes] = []
    total = 0
    try:
        for chunk in response.iter_content(chunk_bytes):
            if not chunk:
                continue
            total += len(chunk)
            if total > max_bytes:
                raise SizeCapExceeded(f"response body exceeded {max_bytes} bytes")
            chunks.append(chunk)
    finally:
        response.close()
    return b"".join(chunks)


class _PinnedAdapter(HTTPAdapter):
    """Connects to a fixed IP while keeping the real hostname for TLS SNI."""

    def __init__(self, server_hostname: str | None = None, **kwargs) -> None:
        self._server_hostname = server_hostname
        super().__init__(**kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        if self._server_hostname is not None:
            # urllib3 hands this to HTTPSConnection: it becomes the SNI name
            # *and* the name the certificate is matched against, while the
            # socket still connects to the IP in the URL.
            pool_kwargs["server_hostname"] = self._server_hostname
        return super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


class PinnedTransport:
    """One request, to one pre-validated address, no redirects, no session."""

    def get(
        self,
        target: Target,
        headers: Mapping[str, str],
        timeout: float = DEFAULT_TIMEOUT,
        max_bytes: int = MAX_BYTES,
    ) -> HttpResponse:
        sent = dict(headers)
        sent["Host"] = target.host_header
        request = requests.Request("GET", target.pinned_url, headers=sent).prepare()
        adapter = _PinnedAdapter(
            server_hostname=target.host if target.scheme == "https" else None
        )
        try:
            raw = adapter.send(request, stream=True, timeout=timeout, verify=True)
        except requests.RequestException as exc:
            adapter.close()
            raise TransportError(f"{target.url}: {exc}") from exc
        try:
            body = read_capped(raw, max_bytes)
        except requests.RequestException as exc:
            raise TransportError(f"{target.url}: {exc}") from exc
        finally:
            adapter.close()
        return HttpResponse(
            url=target.url,
            status=raw.status_code,
            headers=raw.headers,
            body=body,
        )
