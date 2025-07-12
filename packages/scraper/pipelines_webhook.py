"""
Webhook Pipeline for Inplain.AI Scraper

Sends scraped data to the Vercel API via webhook
"""

import json
import os
from typing import Any, Dict
import requests
from scrapy import Spider
from scrapy.exceptions import DropItem
import logging

logger = logging.getLogger(__name__)


class WebhookNotificationPipeline:
    """Send scraped data to Vercel API via webhook"""
    
    def __init__(self, webhook_url: str, api_key: str):
        self.webhook_url = webhook_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers['X-API-Key'] = api_key
        self.session.headers['Content-Type'] = 'application/json'
    
    @classmethod
    def from_crawler(cls, crawler):
        webhook_url = crawler.settings.get('WEBHOOK_URL')
        api_key = crawler.settings.get('WEBHOOK_API_KEY') or crawler.settings.get('SCRAPER_API_KEY')
        
        if not webhook_url:
            logger.warning('WEBHOOK_URL not configured, webhook pipeline disabled')
            return None
            
        if not api_key:
            logger.warning('WEBHOOK_API_KEY not configured, webhook pipeline disabled')
            return None
            
        return cls(webhook_url, api_key)
    
    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        if not self.webhook_url:
            return item
            
        try:
            # Prepare webhook payload
            payload = {
                'job_id': f"scrape-{item['slug']}-{item['captured_at']}",
                'status': 'completed',
                'timestamp': item['captured_at'],
                'data': {
                    'company_slug': item['slug'],
                    'url': item['url'],
                    'content': item['content'],
                    'content_type': item['content_type'],
                    'content_hash': item['content_hash'],
                    'content_length': item['content_length'],
                    'scraped_at': item['captured_at'],
                    'blob_key': item.get('blob_key'),
                    'headers': item.get('headers', {})
                }
            }
            
            # Send to webhook
            response = self.session.post(
                self.webhook_url,
                json=payload,
                timeout=30
            )
            
            if response.status_code not in [200, 201, 202]:
                logger.error(f"Webhook failed: {response.status_code} - {response.text}")
                # Don't drop item, just log the error
            else:
                spider.logger.info(f"Webhook notification sent for {item['slug']}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Webhook request failed: {str(e)}")
            # Don't drop item on webhook failure
        except Exception as e:
            logger.error(f"Unexpected webhook error: {str(e)}")
            
        return item


class VercelStoragePipeline:
    """Store data directly in Vercel's system via API"""
    
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers['Authorization'] = f'Bearer {api_key}'
    
    @classmethod
    def from_crawler(cls, crawler):
        api_url = crawler.settings.get('VERCEL_API_URL', os.getenv('VERCEL_API_URL', ''))
        api_key = crawler.settings.get('VERCEL_API_KEY', os.getenv('VERCEL_API_KEY', ''))
        
        if not api_url or not api_key:
            logger.info('Vercel storage not configured, using Redis storage')
            return None
            
        return cls(api_url, api_key)
    
    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        if not self.api_url:
            return item
            
        try:
            # Store snapshot via API
            snapshot_data = {
                'id': item['id'],
                'slug': item['slug'],
                'url': item['url'],
                'capturedAt': item['captured_at'],
                'blobKey': item.get('blob_key', ''),
                'contentHash': item['content_hash'],
                'contentLength': item['content_length'],
                'contentType': item['content_type'],
                'content': item['content'],
                'headers': item.get('headers', {}),
                'status': 'processed'
            }
            
            response = self.session.post(
                f"{self.api_url}/api/snapshots/{item['slug']}",
                json=snapshot_data,
                timeout=30
            )
            
            if response.status_code not in [200, 201]:
                logger.error(f"Failed to store snapshot: {response.status_code}")
            else:
                spider.logger.info(f"Stored snapshot in Vercel: {item['id']}")
                
        except Exception as e:
            logger.error(f"Vercel storage error: {str(e)}")
            
        return item