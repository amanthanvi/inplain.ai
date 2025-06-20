import re
import uuid
from datetime import datetime
from typing import Generator, Optional
from urllib.parse import urljoin, urlparse

import scrapy
from scrapy.http import Response
from bs4 import BeautifulSoup
import PyPDF2
from io import BytesIO


class PolicySpider(scrapy.Spider):
    name = 'policy'
    allowed_domains = []
    
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
    }

    def __init__(self, urls: Optional[str] = None, *args, **kwargs):
        super(PolicySpider, self).__init__(*args, **kwargs)
        
        if urls:
            self.start_urls = [url.strip() for url in urls.split(',')]
            self.allowed_domains = [urlparse(url).netloc for url in self.start_urls]
        else:
            self.start_urls = []
            
        self.policy_keywords = [
            'privacy', 'policy', 'terms', 'service', 'tos', 'legal',
            'data', 'protection', 'gdpr', 'ccpa', 'cookies'
        ]

    def start_requests(self) -> Generator[scrapy.Request, None, None]:
        for url in self.start_urls:
            slug = self.generate_slug(url)
            
            meta = {
                'slug': slug,
                'start_url': url,
                'depth': 0
            }
            
            if self.should_use_playwright(url):
                meta['playwright'] = True
                meta['wait_for_selector'] = 'body'
            
            yield scrapy.Request(
                url,
                callback=self.parse,
                meta=meta,
                dont_filter=True
            )

    def parse(self, response: Response) -> Generator[dict, None, None]:
        slug = response.meta['slug']
        start_url = response.meta['start_url']
        
        if response.headers.get('Content-Type', b'').decode().startswith('application/pdf'):
            yield from self.parse_pdf(response)
            return
        
        if self.is_policy_page(response):
            content = self.extract_content(response)
            
            yield {
                'id': str(uuid.uuid4()),
                'slug': slug,
                'url': response.url,
                'start_url': start_url,
                'content': content,
                'content_type': 'html',
                'captured_at': datetime.utcnow().isoformat() + 'Z',
                'headers': dict(response.headers),
                'status_code': response.status
            }
        
        if response.meta['depth'] == 0:
            for link in self.extract_policy_links(response):
                absolute_url = urljoin(response.url, link)
                
                if self.is_valid_policy_url(absolute_url):
                    meta = response.meta.copy()
                    meta['depth'] = 1
                    
                    yield response.follow(
                        absolute_url,
                        callback=self.parse,
                        meta=meta
                    )

    def parse_pdf(self, response: Response) -> Generator[dict, None, None]:
        try:
            pdf_file = BytesIO(response.body)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_content = []
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text_content.append(page.extract_text())
            
            content = '\n\n'.join(text_content)
            
            yield {
                'id': str(uuid.uuid4()),
                'slug': response.meta['slug'],
                'url': response.url,
                'start_url': response.meta['start_url'],
                'content': content,
                'content_type': 'pdf',
                'captured_at': datetime.utcnow().isoformat() + 'Z',
                'headers': dict(response.headers),
                'status_code': response.status
            }
            
        except Exception as e:
            self.logger.error(f"PDF parsing error for {response.url}: {str(e)}")

    def is_policy_page(self, response: Response) -> bool:
        url_lower = response.url.lower()
        
        if any(keyword in url_lower for keyword in self.policy_keywords):
            return True
        
        title = response.css('title::text').get('').lower()
        if any(keyword in title for keyword in self.policy_keywords):
            return True
        
        h1_text = ' '.join(response.css('h1::text').getall()).lower()
        if any(keyword in h1_text for keyword in self.policy_keywords):
            return True
        
        body_text = response.css('body::text').get('')[:1000].lower()
        keyword_count = sum(1 for keyword in self.policy_keywords if keyword in body_text)
        
        return keyword_count >= 3

    def extract_content(self, response: Response) -> str:
        soup = BeautifulSoup(response.text, 'lxml')
        
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()
        
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile('content|policy|terms'))
        
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)

    def extract_policy_links(self, response: Response) -> Generator[str, None, None]:
        all_links = response.css('a::attr(href)').getall()
        
        for link in all_links:
            link_lower = link.lower()
            link_text = response.css(f'a[href="{link}"]::text').get('').lower()
            
            if any(keyword in link_lower or keyword in link_text for keyword in self.policy_keywords):
                yield link

    def is_valid_policy_url(self, url: str) -> bool:
        parsed = urlparse(url)
        
        if parsed.scheme not in ['http', 'https']:
            return False
        
        invalid_extensions = ['.jpg', '.png', '.gif', '.mp4', '.zip', '.exe']
        if any(url.lower().endswith(ext) for ext in invalid_extensions):
            return False
        
        return True

    def should_use_playwright(self, url: str) -> bool:
        playwright_domains = [
            'facebook.com', 'meta.com', 'instagram.com',
            'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com'
        ]
        
        domain = urlparse(url).netloc.lower()
        return any(d in domain for d in playwright_domains)

    def generate_slug(self, url: str) -> str:
        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '')
        
        path_parts = [p for p in parsed.path.split('/') if p]
        if path_parts:
            slug = f"{domain}-{'-'.join(path_parts[:2])}"
        else:
            slug = domain
        
        return re.sub(r'[^a-z0-9-]', '-', slug.lower()).strip('-')