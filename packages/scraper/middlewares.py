import random
import asyncio
from typing import Optional
from urllib.parse import urlparse

from scrapy import signals
from scrapy.http import HtmlResponse
from scrapy.utils.python import to_bytes
from playwright.async_api import async_playwright, Browser, Page
import logging

logger = logging.getLogger(__name__)


class PolicyDiffSpiderMiddleware:
    @classmethod
    def from_crawler(cls, crawler):
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_spider_input(self, response, spider):
        return None

    def process_spider_output(self, response, result, spider):
        for i in result:
            yield i

    def process_spider_exception(self, response, exception, spider):
        pass

    def process_start_requests(self, start_requests, spider):
        for r in start_requests:
            yield r

    def spider_opened(self, spider):
        spider.logger.info(f'Spider opened: {spider.name}')


class PolicyDiffDownloaderMiddleware:
    @classmethod
    def from_crawler(cls, crawler):
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_request(self, request, spider):
        return None

    def process_response(self, request, response, spider):
        return response

    def process_exception(self, request, exception, spider):
        pass

    def spider_opened(self, spider):
        spider.logger.info(f'Spider opened: {spider.name}')


class RotateUserAgentMiddleware:
    def __init__(self):
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            'PolicyDiff/1.0 (+https://policydiff.com)'
        ]

    def process_request(self, request, spider):
        ua = random.choice(self.user_agents)
        request.headers['User-Agent'] = ua


class PlaywrightMiddleware:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.playwright = None
        self.loop = None

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)
        return middleware

    def spider_opened(self, spider):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def spider_closed(self, spider):
        if self.browser:
            self.loop.run_until_complete(self._close_browser())
        if self.loop:
            self.loop.close()

    async def _close_browser(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    def process_request(self, request, spider):
        if not request.meta.get('playwright', False):
            return None

        return self.loop.run_until_complete(self._process_with_playwright(request, spider))

    async def _process_with_playwright(self, request, spider):
        if not self.browser:
            self.playwright = await async_playwright().start()
            launch_options = spider.settings.get('PLAYWRIGHT_LAUNCH_OPTIONS', {})
            self.browser = await self.playwright.chromium.launch(**launch_options)

        page = await self.browser.new_page()
        
        try:
            await page.goto(request.url, wait_until='networkidle', timeout=30000)
            
            await page.wait_for_timeout(2000)
            
            if request.meta.get('wait_for_selector'):
                await page.wait_for_selector(
                    request.meta['wait_for_selector'],
                    timeout=10000
                )
            
            content = await page.content()
            
            cookies = await page.context.cookies()
            
            return HtmlResponse(
                url=page.url,
                body=to_bytes(content),
                encoding='utf-8',
                request=request,
                headers={'Content-Type': 'text/html; charset=utf-8'}
            )
            
        except Exception as e:
            logger.error(f"Playwright error for {request.url}: {str(e)}")
            raise
        finally:
            await page.close()

    def should_use_playwright(self, url: str) -> bool:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        playwright_domains = [
            'facebook.com',
            'meta.com',
            'instagram.com',
            'twitter.com',
            'x.com',
            'linkedin.com',
            'tiktok.com'
        ]
        
        return any(domain.endswith(d) for d in playwright_domains)