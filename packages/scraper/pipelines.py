import hashlib
import json
from datetime import datetime
from typing import Any, Dict

import requests
from scrapy import Spider
from scrapy.exceptions import DropItem
import redis
import logging

logger = logging.getLogger(__name__)


class ValidationPipeline:
    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        required_fields = ['url', 'content', 'content_type', 'captured_at']
        
        for field in required_fields:
            if field not in item or not item[field]:
                raise DropItem(f"Missing required field: {field}")
        
        if len(item['content']) < 100:
            raise DropItem(f"Content too short: {len(item['content'])} bytes")
        
        if item['content_type'] not in ['html', 'pdf', 'text']:
            raise DropItem(f"Invalid content type: {item['content_type']}")
        
        item['content_hash'] = hashlib.sha256(item['content'].encode()).hexdigest()
        item['content_length'] = len(item['content'])
        
        return item


class StoragePipeline:
    def __init__(self, blob_url: str, blob_token: str):
        self.blob_url = blob_url
        self.blob_token = blob_token
        self.session = requests.Session()
        if blob_token:
            self.session.headers['Authorization'] = f'Bearer {blob_token}'

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            blob_url=crawler.settings.get('BLOB_STORAGE_URL'),
            blob_token=crawler.settings.get('BLOB_STORAGE_TOKEN', '')
        )

    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        try:
            timestamp = datetime.fromisoformat(item['captured_at'].replace('Z', '+00:00'))
            blob_key = f"snapshots/{item['slug']}/{timestamp.isoformat()}.{item['content_type']}"
            
            if self.blob_url.startswith('http://localhost'):
                response = self.session.put(
                    f"{self.blob_url}/upload",
                    json={
                        'key': blob_key,
                        'content': item['content'],
                        'content_type': f"text/{item['content_type']}"
                    }
                )
            else:
                response = self.session.put(
                    f"{self.blob_url}/{blob_key}",
                    data=item['content'].encode('utf-8'),
                    headers={
                        'Content-Type': f"text/{item['content_type']}",
                        'x-add-random-suffix': 'false'
                    }
                )
            
            if response.status_code not in [200, 201]:
                logger.error(f"Failed to upload to blob storage: {response.status_code}")
                raise DropItem(f"Storage upload failed: {response.status_code}")
            
            item['blob_key'] = blob_key
            spider.logger.info(f"Stored snapshot: {blob_key}")
            
        except Exception as e:
            logger.error(f"Storage error: {str(e)}")
            raise DropItem(f"Storage error: {str(e)}")
        
        return item


class NotificationPipeline:
    def __init__(self, redis_url: str):
        self.redis_client = redis.from_url(redis_url, decode_responses=True)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            redis_url=crawler.settings.get('REDIS_URL')
        )

    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        try:
            snapshot_data = {
                'id': item['id'],
                'slug': item['slug'],
                'url': item['url'],
                'captured_at': item['captured_at'],
                'blob_key': item['blob_key'],
                'content_hash': item['content_hash'],
                'content_length': item['content_length'],
                'content_type': item['content_type'],
                'headers': item.get('headers', {}),
                'status': 'processed'
            }
            
            snapshot_key = f"snapshot:{item['slug']}:{item['id']}"
            self.redis_client.setex(
                snapshot_key,
                86400,
                json.dumps(snapshot_data)
            )
            
            self.redis_client.zadd(
                f"snapshots:{item['slug']}",
                {snapshot_key: datetime.fromisoformat(item['captured_at'].replace('Z', '+00:00')).timestamp()}
            )
            
            existing_snapshots = self.redis_client.zrevrange(
                f"snapshots:{item['slug']}",
                0, 1
            )
            
            if len(existing_snapshots) > 1:
                self.redis_client.lpush(
                    'diff:queue',
                    json.dumps({
                        'slug': item['slug'],
                        'from_snapshot': existing_snapshots[1],
                        'to_snapshot': snapshot_key,
                        'timestamp': item['captured_at']
                    })
                )
                spider.logger.info(f"Queued diff job for {item['slug']}")
            
        except Exception as e:
            logger.error(f"Notification error: {str(e)}")
        
        return item