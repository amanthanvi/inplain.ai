import scrapy
from policies_scraper.items import PoliciesScraperItem
from datetime import datetime
import re


class PolicySpider(scrapy.Spider):
    name = "policy_spider"

    # Example company list - replace with real URLs of the company policy pages
    company_policy_pages = {
        "Google": "https://policies.google.com/privacy",
        "Apple": "https://www.apple.com/legal/privacy/en-ww/",
        "Microsoft": "https://privacy.microsoft.com/en-us/privacystatement",
        # Add more company policy URLs here
    }

    start_urls = list(company_policy_pages.values())

    def parse(self, response):
        item = PoliciesScraperItem()

        # Extract company name based on URL
        for company, url in self.company_policy_pages.items():
            if url in response.url:
                item["company_name"] = company
                break

        # Extract policy text (likely to need adjustment per site)
        policy_content = response.xpath(
            '//div[contains(@class, "privacy-policy")]//text()'
        ).getall()
        policy_text = " ".join(policy_content).strip()
        item["policy_text"] = policy_text

        # Extract last updated date (example pattern, adjust for each site)
        last_updated_text = response.xpath(
            '//*[contains(text(), "Last Updated")]//text()'
        ).get()
        if last_updated_text:
            last_updated_date = re.search(
                r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b",
                last_updated_text,
            )
            if last_updated_date:
                item["last_updated"] = last_updated_date.group()

        yield item
