"""
Enhanced Policy Spider for Inplain.AI
Phase 2: Robust scraping with advanced JS handling and content extraction
"""

import re
import uuid
import hashlib
from datetime import datetime
from typing import Dict, Generator, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
import json

import scrapy
from scrapy.http import Response
from bs4 import BeautifulSoup, NavigableString
import PyPDF2
from io import BytesIO
import langdetect


class EnhancedPolicySpider(scrapy.Spider):
    """Enhanced spider with robust scraping capabilities"""
    
    name = 'enhanced_policy'
    allowed_domains = []
    
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 408, 522, 524],
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        },
        # Playwright settings for JS-heavy sites
        'PLAYWRIGHT_LAUNCH_OPTIONS': {
            'headless': True,
            'args': ['--no-sandbox', '--disable-dev-shm-usage']
        },
        'PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT': 30000,
    }

    # Enhanced keyword detection
    POLICY_KEYWORDS = {
        'primary': ['privacy', 'policy', 'data protection', 'personal information', 'terms of service'],
        'secondary': ['gdpr', 'ccpa', 'cookies', 'data collection', 'user rights', 'legal'],
        'tertiary': ['consent', 'opt-out', 'third party', 'retention', 'security']
    }
    
    # Advanced selector patterns for different site structures
    CONTENT_SELECTORS = [
        # Specific policy containers
        {'selector': 'main[role="main"]', 'priority': 1},
        {'selector': 'article', 'priority': 2},
        {'selector': 'div[class*="privacy"]', 'priority': 3},
        {'selector': 'div[class*="policy"]', 'priority': 3},
        {'selector': 'div[class*="content"]', 'priority': 4},
        {'selector': 'div[class*="legal"]', 'priority': 4},
        {'selector': 'section[class*="privacy"]', 'priority': 4},
        # Generic containers
        {'selector': '.main-content', 'priority': 5},
        {'selector': '#content', 'priority': 5},
        {'selector': 'main', 'priority': 6},
        {'selector': 'body', 'priority': 10}  # Last resort
    ]
    
    # JS-heavy domains that require special handling
    JS_HEAVY_DOMAINS = {
        'facebook.com': {'wait_for': 'div[role="main"]', 'timeout': 10000},
        'meta.com': {'wait_for': 'main', 'timeout': 10000},
        'twitter.com': {'wait_for': 'main', 'timeout': 10000},
        'x.com': {'wait_for': 'main', 'timeout': 10000},
        'linkedin.com': {'wait_for': 'main', 'timeout': 10000},
        'tiktok.com': {'wait_for': 'div[class*="policy"]', 'timeout': 15000},
        'instagram.com': {'wait_for': 'main', 'timeout': 10000},
        'youtube.com': {'wait_for': 'ytd-app', 'timeout': 10000},
        'reddit.com': {'wait_for': 'div[class*="content"]', 'timeout': 10000},
        'cloudflare.com': {'wait_for': 'main', 'timeout': 5000}
    }

    def __init__(self, urls: Optional[str] = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        if urls:
            self.start_urls = [url.strip() for url in urls.split(',')]
            self.allowed_domains = [urlparse(url).netloc for url in self.start_urls]
        else:
            self.start_urls = []
            
        # Track scraping metrics
        self.metrics = {
            'total_pages': 0,
            'policy_pages': 0,
            'js_rendered': 0,
            'pdfs_parsed': 0,
            'errors': 0
        }

    def start_requests(self) -> Generator[scrapy.Request, None, None]:
        """Generate initial requests with enhanced metadata"""
        for url in self.start_urls:
            slug = self.generate_enhanced_slug(url)
            domain = urlparse(url).netloc.lower()
            
            meta = {
                'slug': slug,
                'start_url': url,
                'depth': 0,
                'domain': domain,
                'attempt': 1
            }
            
            # Configure Playwright for JS-heavy sites
            if self.requires_javascript(domain):
                js_config = self.JS_HEAVY_DOMAINS.get(domain, {})
                meta['playwright'] = True
                meta['playwright_page_methods'] = [
                    {'method': 'wait_for_selector', 'selector': js_config.get('wait_for', 'body'), 'timeout': js_config.get('timeout', 10000)},
                    {'method': 'wait_for_load_state', 'state': 'networkidle', 'timeout': 5000}
                ]
                self.metrics['js_rendered'] += 1
            
            yield scrapy.Request(
                url,
                callback=self.parse,
                meta=meta,
                dont_filter=True,
                errback=self.handle_error
            )

    def parse(self, response: Response) -> Generator[dict, None, None]:
        """Enhanced parsing with fallback strategies"""
        self.metrics['total_pages'] += 1
        
        # Handle PDFs
        content_type = response.headers.get('Content-Type', b'').decode().lower()
        if 'pdf' in content_type:
            yield from self.parse_pdf_enhanced(response)
            return
        
        # Detect if this is a policy page
        if self.is_policy_page_enhanced(response):
            self.metrics['policy_pages'] += 1
            
            # Extract content with multiple strategies
            content_data = self.extract_content_enhanced(response)
            
            if content_data['content'] and len(content_data['content']) > 100:
                yield {
                    'id': str(uuid.uuid4()),
                    'slug': response.meta['slug'],
                    'url': response.url,
                    'start_url': response.meta['start_url'],
                    'content': content_data['content'],
                    'content_type': 'html',
                    'captured_at': datetime.utcnow().isoformat() + 'Z',
                    'headers': dict(response.headers),
                    'status_code': response.status,
                    'metadata': {
                        'title': content_data['title'],
                        'last_updated': content_data['last_updated'],
                        'effective_date': content_data['effective_date'],
                        'language': content_data['language'],
                        'word_count': content_data['word_count'],
                        'extraction_method': content_data['extraction_method'],
                        'js_rendered': response.meta.get('playwright', False),
                        'content_hash': hashlib.sha256(content_data['content'].encode()).hexdigest()
                    }
                }
            else:
                self.logger.warning(f"Insufficient content extracted from {response.url}")
                
                # Retry with JS rendering if not already tried
                if not response.meta.get('playwright') and response.meta.get('attempt', 1) < 2:
                    yield from self.retry_with_javascript(response)
                    return
        
        # Follow policy links from the homepage
        if response.meta['depth'] == 0:
            yield from self.follow_policy_links(response)

    def parse_pdf_enhanced(self, response: Response) -> Generator[dict, None, None]:
        """Enhanced PDF parsing with better error handling"""
        try:
            pdf_file = BytesIO(response.body)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_content = []
            metadata = {}
            
            # Extract PDF metadata
            if pdf_reader.metadata:
                metadata['pdf_title'] = pdf_reader.metadata.get('/Title', '')
                metadata['pdf_author'] = pdf_reader.metadata.get('/Author', '')
                metadata['pdf_creation_date'] = str(pdf_reader.metadata.get('/CreationDate', ''))
            
            # Extract text from all pages
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                if text.strip():
                    text_content.append(f"[Page {page_num + 1}]\n{text}")
            
            content = '\n\n'.join(text_content)
            
            if content and len(content) > 100:
                self.metrics['pdfs_parsed'] += 1
                
                yield {
                    'id': str(uuid.uuid4()),
                    'slug': response.meta['slug'],
                    'url': response.url,
                    'start_url': response.meta['start_url'],
                    'content': content,
                    'content_type': 'pdf',
                    'captured_at': datetime.utcnow().isoformat() + 'Z',
                    'headers': dict(response.headers),
                    'status_code': response.status,
                    'metadata': {
                        **metadata,
                        'pages': len(pdf_reader.pages),
                        'word_count': len(content.split()),
                        'content_hash': hashlib.sha256(content.encode()).hexdigest()
                    }
                }
            
        except Exception as e:
            self.logger.error(f"PDF parsing error for {response.url}: {str(e)}")
            self.metrics['errors'] += 1

    def is_policy_page_enhanced(self, response: Response) -> bool:
        """Enhanced policy page detection with scoring system"""
        score = 0
        url_lower = response.url.lower()
        
        # URL analysis (highest weight)
        for keyword in self.POLICY_KEYWORDS['primary']:
            if keyword.replace(' ', '-') in url_lower or keyword.replace(' ', '_') in url_lower:
                score += 5
        
        for keyword in self.POLICY_KEYWORDS['secondary']:
            if keyword in url_lower:
                score += 3
                
        # Title analysis
        title = response.css('title::text').get('').lower()
        for keyword in self.POLICY_KEYWORDS['primary']:
            if keyword in title:
                score += 4
                
        # Heading analysis
        headings = ' '.join(response.css('h1::text, h2::text').getall()).lower()
        for keyword in self.POLICY_KEYWORDS['primary']:
            if keyword in headings:
                score += 3
                
        # Body text sampling
        body_sample = response.css('body').get('')[:5000].lower()
        
        # Primary keyword density
        primary_count = sum(body_sample.count(kw) for kw in self.POLICY_KEYWORDS['primary'])
        if primary_count > 10:
            score += 5
        elif primary_count > 5:
            score += 3
            
        # Secondary keyword presence
        secondary_count = sum(1 for kw in self.POLICY_KEYWORDS['secondary'] if kw in body_sample)
        score += secondary_count
        
        # Tertiary keyword presence
        tertiary_count = sum(1 for kw in self.POLICY_KEYWORDS['tertiary'] if kw in body_sample)
        score += tertiary_count * 0.5
        
        # Check for legal/policy-specific HTML elements
        if response.css('div[class*="privacy"], div[class*="policy"], section[class*="legal"]'):
            score += 3
            
        return score >= 8  # Threshold for policy page

    def extract_content_enhanced(self, response: Response) -> Dict:
        """Enhanced content extraction with multiple strategies"""
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Remove non-content elements
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            tag.decompose()
            
        # Also remove elements by class/id patterns
        for element in soup.find_all(attrs={'class': re.compile('nav|menu|sidebar|advertisement|banner|popup')}):
            element.decompose()
            
        for element in soup.find_all(attrs={'id': re.compile('nav|menu|sidebar|advertisement|banner|popup')}):
            element.decompose()
        
        # Try selectors in priority order
        main_content = None
        extraction_method = 'fallback'
        
        for selector_info in sorted(self.CONTENT_SELECTORS, key=lambda x: x['priority']):
            try:
                elements = soup.select(selector_info['selector'])
                if elements:
                    # Find the element with the most text content
                    best_element = max(elements, key=lambda el: len(el.get_text(strip=True)))
                    if len(best_element.get_text(strip=True)) > 500:
                        main_content = best_element
                        extraction_method = f"selector: {selector_info['selector']}"
                        break
            except Exception as e:
                self.logger.debug(f"Selector {selector_info['selector']} failed: {e}")
        
        # Extract text content
        if main_content:
            text = self.clean_text_content(main_content)
        else:
            # Fallback: use body with aggressive filtering
            text = self.clean_text_content(soup.body if soup.body else soup)
        
        # Extract metadata
        metadata = self.extract_metadata(soup, text)
        metadata['extraction_method'] = extraction_method
        
        return {
            'content': text,
            **metadata
        }

    def clean_text_content(self, element) -> str:
        """Clean and format extracted text content"""
        if not element:
            return ""
            
        # Preserve structure with proper spacing
        lines = []
        
        for item in element.descendants:
            if isinstance(item, NavigableString):
                text = str(item).strip()
                if text:
                    lines.append(text)
            elif item.name in ['p', 'div', 'section', 'article']:
                lines.append('\n')
            elif item.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                lines.append(f'\n\n{item.get_text(strip=True)}\n')
            elif item.name in ['li']:
                lines.append(f'\n• {item.get_text(strip=True)}')
        
        # Clean up the text
        text = ' '.join(lines)
        
        # Fix spacing issues
        text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 newlines
        text = re.sub(r' {2,}', ' ', text)  # Max 1 space
        text = re.sub(r'\n ', '\n', text)  # No space after newline
        
        return text.strip()

    def extract_metadata(self, soup: BeautifulSoup, content: str) -> Dict:
        """Extract policy metadata"""
        metadata = {
            'title': '',
            'last_updated': None,
            'effective_date': None,
            'language': 'en',
            'word_count': len(content.split())
        }
        
        # Title extraction
        title_tag = soup.find('title')
        if title_tag:
            metadata['title'] = title_tag.get_text(strip=True)
        else:
            # Try h1 as fallback
            h1 = soup.find('h1')
            if h1:
                metadata['title'] = h1.get_text(strip=True)
        
        # Date extraction with multiple patterns
        date_patterns = [
            r'last (?:updated|modified|revised)[:\s]+([A-Za-z]+ \d+,? \d{4})',
            r'effective (?:date|as of)[:\s]+([A-Za-z]+ \d+,? \d{4})',
            r'updated[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
            r'(?:version|v)\s*date[:\s]+([A-Za-z]+ \d+,? \d{4})'
        ]
        
        content_lower = content.lower()
        for pattern in date_patterns:
            match = re.search(pattern, content_lower)
            if match:
                date_str = match.group(1)
                if 'updated' in pattern or 'modified' in pattern or 'revised' in pattern:
                    metadata['last_updated'] = date_str
                else:
                    metadata['effective_date'] = date_str
                    
        # Language detection
        try:
            if len(content) > 50:
                metadata['language'] = langdetect.detect(content[:1000])
        except:
            pass
            
        return metadata

    def follow_policy_links(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Enhanced link following with better pattern matching"""
        all_links = response.css('a')
        
        for link in all_links:
            href = link.css('::attr(href)').get()
            text = link.css('::text').get('').strip()
            
            if not href:
                continue
                
            href_lower = href.lower()
            text_lower = text.lower()
            
            # Score-based link evaluation
            score = 0
            
            # Check URL
            for keyword in self.POLICY_KEYWORDS['primary']:
                if keyword.replace(' ', '-') in href_lower or keyword.replace(' ', '_') in href_lower:
                    score += 3
                    
            for keyword in self.POLICY_KEYWORDS['secondary']:
                if keyword in href_lower:
                    score += 2
                    
            # Check link text
            for keyword in self.POLICY_KEYWORDS['primary']:
                if keyword in text_lower:
                    score += 3
                    
            # Check aria-label
            aria_label = link.css('::attr(aria-label)').get('').lower()
            if any(kw in aria_label for kw in self.POLICY_KEYWORDS['primary']):
                score += 2
                
            if score >= 3:
                absolute_url = urljoin(response.url, href)
                
                if self.is_valid_url(absolute_url):
                    meta = response.meta.copy()
                    meta['depth'] = 1
                    
                    # Add JS rendering for known JS-heavy sites
                    domain = urlparse(absolute_url).netloc.lower()
                    if self.requires_javascript(domain):
                        js_config = self.JS_HEAVY_DOMAINS.get(domain, {})
                        meta['playwright'] = True
                        meta['playwright_page_methods'] = [
                            {'method': 'wait_for_selector', 'selector': js_config.get('wait_for', 'body'), 'timeout': js_config.get('timeout', 10000)}
                        ]
                    
                    yield response.follow(
                        absolute_url,
                        callback=self.parse,
                        meta=meta,
                        errback=self.handle_error
                    )

    def retry_with_javascript(self, response: Response) -> Generator[scrapy.Request, None, None]:
        """Retry failed extraction with JavaScript rendering"""
        self.logger.info(f"Retrying {response.url} with JavaScript rendering")
        
        meta = response.meta.copy()
        meta['playwright'] = True
        meta['playwright_page_methods'] = [
            {'method': 'wait_for_load_state', 'state': 'networkidle', 'timeout': 10000},
            {'method': 'wait_for_timeout', 'timeout': 2000}  # Additional wait for dynamic content
        ]
        meta['attempt'] = meta.get('attempt', 1) + 1
        
        yield scrapy.Request(
            response.url,
            callback=self.parse,
            meta=meta,
            dont_filter=True,
            priority=10  # Higher priority for retries
        )

    def handle_error(self, failure):
        """Enhanced error handling with logging"""
        self.metrics['errors'] += 1
        self.logger.error(f"Request failed: {failure.request.url} - {failure.value}")
        
        # Retry logic for specific errors
        if failure.check(TimeoutError):
            request = failure.request
            if request.meta.get('attempt', 1) < 3:
                meta = request.meta.copy()
                meta['attempt'] = meta.get('attempt', 1) + 1
                meta['download_timeout'] = 60  # Increase timeout
                
                yield scrapy.Request(
                    request.url,
                    callback=self.parse,
                    meta=meta,
                    dont_filter=True,
                    errback=self.handle_error
                )

    def requires_javascript(self, domain: str) -> bool:
        """Check if domain requires JavaScript rendering"""
        # Check exact domain match
        if domain in self.JS_HEAVY_DOMAINS:
            return True
            
        # Check partial matches (e.g., subdomains)
        for js_domain in self.JS_HEAVY_DOMAINS:
            if js_domain in domain or domain.endswith(f'.{js_domain}'):
                return True
                
        return False

    def is_valid_url(self, url: str) -> bool:
        """Enhanced URL validation"""
        parsed = urlparse(url)
        
        if parsed.scheme not in ['http', 'https']:
            return False
        
        # Expanded list of invalid extensions
        invalid_extensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',  # Images
            '.mp4', '.avi', '.mov', '.webm',  # Videos
            '.mp3', '.wav', '.ogg',  # Audio
            '.zip', '.rar', '.7z', '.tar', '.gz',  # Archives
            '.exe', '.dmg', '.pkg', '.deb', '.rpm',  # Executables
            '.css', '.js', '.json', '.xml'  # Code files (unless they might contain policies)
        ]
        
        if any(url.lower().endswith(ext) for ext in invalid_extensions):
            # Exception for .json if it might be a policy endpoint
            if url.lower().endswith('.json') and any(kw in url.lower() for kw in ['privacy', 'policy', 'terms']):
                return True
            return False
        
        # Avoid common non-policy pages
        avoid_patterns = ['login', 'signin', 'signup', 'register', 'download', 'support', 'help', 'faq']
        if any(pattern in url.lower() for pattern in avoid_patterns):
            return False
            
        return True

    def generate_enhanced_slug(self, url: str) -> str:
        """Generate enhanced slug with better consistency"""
        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '').replace('.com', '').replace('.', '-')
        
        # Create slug from domain
        slug = domain.lower()
        
        # Add path components if they're meaningful
        path_parts = [p for p in parsed.path.split('/') if p and p not in ['index.html', 'index.php']]
        if path_parts:
            # Only include meaningful path parts
            meaningful_parts = []
            for part in path_parts[:2]:  # Limit to 2 path components
                if any(kw in part.lower() for kw in ['privacy', 'policy', 'terms', 'legal']):
                    meaningful_parts.append(part)
            
            if meaningful_parts:
                slug = f"{slug}-{'-'.join(meaningful_parts)}"
        
        # Clean up the slug
        slug = re.sub(r'[^a-z0-9-]', '-', slug.lower())
        slug = re.sub(r'-+', '-', slug).strip('-')
        
        # Ensure slug isn't too long
        if len(slug) > 50:
            slug = slug[:50].rsplit('-', 1)[0]
            
        return slug

    def closed(self, reason):
        """Log metrics when spider closes"""
        self.logger.info(f"Spider closed: {reason}")
        self.logger.info(f"Scraping metrics: {json.dumps(self.metrics, indent=2)}")
        
        # Calculate success rate
        if self.metrics['total_pages'] > 0:
            success_rate = (self.metrics['policy_pages'] / self.metrics['total_pages']) * 100
            self.logger.info(f"Policy detection rate: {success_rate:.1f}%")
            
        if self.metrics['js_rendered'] > 0:
            self.logger.info(f"JS rendering used for {self.metrics['js_rendered']} pages")