import pytest
from unittest.mock import Mock, patch
from datetime import datetime

from spiders.policy_spider import PolicySpider
from scrapy.http import TextResponse, Request


class TestPolicySpider:
    def setup_method(self):
        self.spider = PolicySpider(urls='https://example.com/privacy')

    def test_spider_initialization(self):
        assert self.spider.name == 'policy'
        assert self.spider.start_urls == ['https://example.com/privacy']
        assert 'example.com' in self.spider.allowed_domains

    def test_generate_slug(self):
        assert self.spider.generate_slug('https://example.com') == 'example-com'
        assert self.spider.generate_slug('https://www.example.com/privacy') == 'example-com-privacy'
        assert self.spider.generate_slug('https://example.com/privacy/policy') == 'example-com-privacy-policy'

    def test_is_valid_policy_url(self):
        assert self.spider.is_valid_policy_url('https://example.com/privacy')
        assert self.spider.is_valid_policy_url('http://example.com/terms')
        assert not self.spider.is_valid_policy_url('javascript:void(0)')
        assert not self.spider.is_valid_policy_url('https://example.com/image.jpg')

    def test_should_use_playwright(self):
        assert self.spider.should_use_playwright('https://facebook.com/privacy')
        assert self.spider.should_use_playwright('https://www.linkedin.com/legal')
        assert not self.spider.should_use_playwright('https://example.com/privacy')

    def test_is_policy_page(self):
        mock_response = Mock(spec=TextResponse)
        mock_response.url = 'https://example.com/privacy-policy'
        mock_response.css.return_value.get.return_value = 'Privacy Policy'
        mock_response.css.return_value.getall.return_value = ['Privacy Policy']
        
        assert self.spider.is_policy_page(mock_response)

    def test_extract_content(self):
        html = '''
        <html>
            <head>
                <title>Privacy Policy</title>
                <style>body { color: red; }</style>
            </head>
            <body>
                <nav>Navigation</nav>
                <main>
                    <h1>Privacy Policy</h1>
                    <p>We value your privacy.</p>
                </main>
                <footer>Footer</footer>
                <script>console.log('test');</script>
            </body>
        </html>
        '''
        
        response = TextResponse(
            url='https://example.com/privacy',
            body=html.encode('utf-8'),
            encoding='utf-8'
        )
        
        content = self.spider.extract_content(response)
        
        assert 'Privacy Policy' in content
        assert 'We value your privacy.' in content
        assert 'Navigation' not in content
        assert 'Footer' not in content
        assert 'console.log' not in content

    def test_parse_yields_policy_item(self):
        html = '''
        <html>
            <head><title>Privacy Policy</title></head>
            <body>
                <h1>Privacy Policy</h1>
                <p>This is our privacy policy.</p>
            </body>
        </html>
        '''
        
        response = TextResponse(
            url='https://example.com/privacy',
            body=html.encode('utf-8'),
            encoding='utf-8',
            request=Request(
                url='https://example.com/privacy',
                meta={'slug': 'example-com', 'start_url': 'https://example.com/privacy', 'depth': 0}
            )
        )
        
        items = list(self.spider.parse(response))
        
        assert len(items) >= 1
        item = items[0]
        
        assert item['slug'] == 'example-com'
        assert item['url'] == 'https://example.com/privacy'
        assert item['content_type'] == 'html'
        assert 'Privacy Policy' in item['content']
        assert 'captured_at' in item