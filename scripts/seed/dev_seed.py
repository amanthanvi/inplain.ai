from __future__ import annotations

import argparse

import httpx


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed local/dev Inplain API with sample data.")
    parser.add_argument(
        "--api-base-url",
        default="http://localhost:8000",
        help="Base URL for the API (default: http://localhost:8000).",
    )
    parser.add_argument(
        "--email",
        default="dev@inplain.local",
        help="Email used for dev auth bypass (default: dev@inplain.local).",
    )
    parser.add_argument(
        "--entity-name",
        default="Example Corp",
        help="Entity name to create (default: Example Corp).",
    )
    parser.add_argument(
        "--document-url",
        default="https://example.com/",
        help="Document URL to track (default: https://example.com/).",
    )
    args = parser.parse_args()

    headers = {"X-Dev-Email": args.email, "X-Dev-Clerk-User-Id": args.email}

    with httpx.Client(base_url=args.api_base_url, headers=headers, timeout=15.0) as client:
        entity_res = client.post(
            "/v1/entities",
            json={"name": args.entity_name, "websiteUrl": args.document_url},
        )
        entity_res.raise_for_status()
        entity = entity_res.json()

        doc_res = client.post(
            f"/v1/entities/{entity['id']}/documents",
            json={"url": args.document_url, "docType": "privacy", "scheduleTier": "daily"},
        )
        doc_res.raise_for_status()
        doc = doc_res.json()

    print("Seeded:")
    print(f"- Entity: {entity['id']} ({entity['name']})")
    print(f"- Document: {doc['id']} ({doc['url']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

