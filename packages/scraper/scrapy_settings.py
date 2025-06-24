import os
from datetime import datetime

BOT_NAME = 'policydiff'

SPIDER_MODULES = ['spiders']
NEWSPIDER_MODULE = 'spiders'

USER_AGENT = 'Inplain.AI/1.0 (+https://inplain.ai)'

ROBOTSTXT_OBEY = True

CONCURRENT_REQUESTS = 16
CONCURRENT_REQUESTS_PER_DOMAIN = 2

DOWNLOAD_DELAY = 1
DOWNLOAD_TIMEOUT = 30

COOKIES_ENABLED = True

TELNETCONSOLE_ENABLED = False

DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
}

SPIDER_MIDDLEWARES = {
    'middlewares.Inplain.AISpiderMiddleware': 543,
}

DOWNLOADER_MIDDLEWARES = {
    'middlewares.Inplain.AIDownloaderMiddleware': 543,
    'middlewares.PlaywrightMiddleware': 585,
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
    'middlewares.RotateUserAgentMiddleware': 400,
}

ITEM_PIPELINES = {
    'pipelines.ValidationPipeline': 100,
    'pipelines.StoragePipeline': 200,
    'pipelines.NotificationPipeline': 300,
}

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 4.0
AUTOTHROTTLE_DEBUG = False

HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 3600
HTTPCACHE_DIR = 'httpcache'
HTTPCACHE_IGNORE_HTTP_CODES = [503, 504, 400, 403, 404]
HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = '%(levelname)s [%(name)s] %(message)s'

RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

DOWNLOAD_HANDLERS = {
    'https': 'scrapy.core.downloader.handlers.http2.H2DownloadHandler',
    'http': 'scrapy.core.downloader.handlers.http2.H2DownloadHandler',
}

BLOB_STORAGE_URL = os.getenv('BLOB_STORAGE_URL', 'http://localhost:4566')
BLOB_STORAGE_TOKEN = os.getenv('BLOB_STORAGE_TOKEN', '')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

PLAYWRIGHT_BROWSER_TYPE = 'chromium'
PLAYWRIGHT_LAUNCH_OPTIONS = {
    'headless': True,
    'args': [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
    ]
}