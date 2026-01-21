from __future__ import annotations

from typing import TypedDict

from inplain.db.models.enums import DocumentDocType


class CatalogDocument(TypedDict):
    url: str
    doc_type: DocumentDocType


class CatalogCompany(TypedDict):
    name: str
    website_url: str | None
    documents: list[CatalogDocument]


COMPANY_CATALOG: dict[str, CatalogCompany] = {
    "google": {
        "name": "Google",
        "website_url": "https://www.google.com",
        "documents": [
            {"url": "https://policies.google.com/privacy", "doc_type": DocumentDocType.privacy},
            {"url": "https://policies.google.com/terms", "doc_type": DocumentDocType.tos},
        ],
    },
    "apple": {
        "name": "Apple",
        "website_url": "https://www.apple.com",
        "documents": [
            {"url": "https://www.apple.com/legal/privacy/", "doc_type": DocumentDocType.privacy},
            {
                "url": "https://www.apple.com/legal/internet-services/terms/site.html",
                "doc_type": DocumentDocType.tos,
            },
        ],
    },
    "meta": {
        "name": "Meta",
        "website_url": "https://about.meta.com",
        "documents": [
            {
                "url": "https://www.facebook.com/privacy/policy/",
                "doc_type": DocumentDocType.privacy,
            },
            {"url": "https://www.facebook.com/terms.php", "doc_type": DocumentDocType.tos},
        ],
    },
    "amazon": {
        "name": "Amazon",
        "website_url": "https://www.amazon.com",
        "documents": [
            {
                "url": "https://www.amazon.com/gp/help/customer/display.html?nodeId=468496",
                "doc_type": DocumentDocType.privacy,
            },
            {
                "url": "https://www.amazon.com/gp/help/customer/display.html?nodeId=508088",
                "doc_type": DocumentDocType.tos,
            },
        ],
    },
    "microsoft": {
        "name": "Microsoft",
        "website_url": "https://www.microsoft.com",
        "documents": [
            {
                "url": "https://privacy.microsoft.com/privacystatement",
                "doc_type": DocumentDocType.privacy,
            },
            {"url": "https://www.microsoft.com/servicesagreement", "doc_type": DocumentDocType.tos},
        ],
    },
    "github": {
        "name": "GitHub",
        "website_url": "https://github.com",
        "documents": [
            {
                "url": "https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement",
                "doc_type": DocumentDocType.privacy,
            },
            {
                "url": "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
                "doc_type": DocumentDocType.tos,
            },
        ],
    },
    "netflix": {
        "name": "Netflix",
        "website_url": "https://www.netflix.com",
        "documents": [
            {"url": "https://help.netflix.com/legal/privacy", "doc_type": DocumentDocType.privacy},
            {"url": "https://help.netflix.com/legal/termsofuse", "doc_type": DocumentDocType.tos},
        ],
    },
    "spotify": {
        "name": "Spotify",
        "website_url": "https://www.spotify.com",
        "documents": [
            {
                "url": "https://www.spotify.com/us/legal/privacy-policy/",
                "doc_type": DocumentDocType.privacy,
            },
            {
                "url": "https://www.spotify.com/us/legal/end-user-agreement/",
                "doc_type": DocumentDocType.tos,
            },
        ],
    },
    "slack": {
        "name": "Slack",
        "website_url": "https://slack.com",
        "documents": [
            {
                "url": "https://slack.com/trust/privacy/privacy-policy",
                "doc_type": DocumentDocType.privacy,
            },
            {"url": "https://slack.com/terms-of-service", "doc_type": DocumentDocType.tos},
        ],
    },
    "zoom": {
        "name": "Zoom",
        "website_url": "https://zoom.us",
        "documents": [
            {"url": "https://explore.zoom.us/en/privacy/", "doc_type": DocumentDocType.privacy},
            {"url": "https://explore.zoom.us/en/terms/", "doc_type": DocumentDocType.tos},
        ],
    },
    "linkedin": {
        "name": "LinkedIn",
        "website_url": "https://www.linkedin.com",
        "documents": [
            {
                "url": "https://www.linkedin.com/legal/privacy-policy",
                "doc_type": DocumentDocType.privacy,
            },
            {
                "url": "https://www.linkedin.com/legal/user-agreement",
                "doc_type": DocumentDocType.tos,
            },
        ],
    },
    "twitter": {
        "name": "X (Twitter)",
        "website_url": "https://x.com",
        "documents": [
            {"url": "https://twitter.com/en/privacy", "doc_type": DocumentDocType.privacy},
            {"url": "https://twitter.com/en/tos", "doc_type": DocumentDocType.tos},
        ],
    },
    "tiktok": {
        "name": "TikTok",
        "website_url": "https://www.tiktok.com",
        "documents": [
            {
                "url": "https://www.tiktok.com/legal/page/us/privacy-policy/en",
                "doc_type": DocumentDocType.privacy,
            },
            {
                "url": "https://www.tiktok.com/legal/page/us/terms-of-service/en",
                "doc_type": DocumentDocType.tos,
            },
        ],
    },
    "dropbox": {
        "name": "Dropbox",
        "website_url": "https://www.dropbox.com",
        "documents": [
            {"url": "https://www.dropbox.com/privacy", "doc_type": DocumentDocType.privacy},
            {"url": "https://www.dropbox.com/terms", "doc_type": DocumentDocType.tos},
        ],
    },
    "stripe": {
        "name": "Stripe",
        "website_url": "https://stripe.com",
        "documents": [
            {"url": "https://stripe.com/privacy", "doc_type": DocumentDocType.privacy},
            {"url": "https://stripe.com/legal", "doc_type": DocumentDocType.tos},
        ],
    },
    "notion": {
        "name": "Notion",
        "website_url": "https://www.notion.so",
        "documents": [
            {
                "url": "https://www.notion.so/notion/Privacy-Policy-3468d120cf614d4c9014c09f6adc9091",
                "doc_type": DocumentDocType.privacy,
            },
            {"url": "https://www.notion.so/terms", "doc_type": DocumentDocType.tos},
        ],
    },
}
