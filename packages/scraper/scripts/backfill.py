#!/usr/bin/env python3
import sys
import csv
import click
import logging
from datetime import datetime, timedelta
from typing import List, Optional

import redis
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


@click.command()
@click.option('--days', type=int, default=30, help='Number of days to backfill')
@click.option('--companies', type=click.Path(exists=True), help='CSV file with companies')
@click.option('--redis-url', type=str, default='redis://localhost:6379', help='Redis URL')
@click.option('--api-url', type=str, default='http://localhost:3000/api', help='API base URL')
def backfill(days: int, companies: str, redis_url: str, api_url: str):
    """Backfill historical diffs from existing snapshots"""
    
    logger.info(f"Starting backfill for {days} days")
    
    redis_client = redis.from_url(redis_url, decode_responses=True)
    
    if companies:
        company_list = load_companies_from_csv(companies)
    else:
        company_list = get_companies_from_redis(redis_client)
    
    if not company_list:
        logger.error("No companies found")
        sys.exit(1)
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    for company in company_list:
        try:
            backfill_company(company['slug'], redis_client, api_url, cutoff_date)
        except Exception as e:
            logger.error(f"Error backfilling {company['slug']}: {e}")


def load_companies_from_csv(filepath: str) -> List[dict]:
    """Load companies from CSV file"""
    companies = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('active', 'true').lower() == 'true':
                    companies.append({
                        'slug': row['slug'],
                        'name': row.get('name', row['slug']),
                        'url': row['url']
                    })
        logger.info(f"Loaded {len(companies)} companies from {filepath}")
    except Exception as e:
        logger.error(f"Error loading CSV: {e}")
        sys.exit(1)
    return companies


def get_companies_from_redis(redis_client) -> List[dict]:
    """Get companies from Redis"""
    try:
        import json
        companies_data = redis_client.get('companies:active')
        if companies_data:
            return json.loads(companies_data)
    except Exception as e:
        logger.error(f"Error getting companies from Redis: {e}")
    return []


def backfill_company(slug: str, redis_client, api_url: str, cutoff_date: datetime):
    """Backfill diffs for a single company"""
    logger.info(f"Backfilling {slug}")
    
    snapshot_keys = redis_client.zrange(f"snapshots:{slug}", 0, -1)
    
    if len(snapshot_keys) < 2:
        logger.info(f"Not enough snapshots for {slug}")
        return
    
    snapshots = []
    for key in snapshot_keys:
        try:
            import json
            snapshot_data = redis_client.get(key)
            if snapshot_data:
                snapshot = json.loads(snapshot_data)
                captured_at = datetime.fromisoformat(snapshot['captured_at'].replace('Z', '+00:00'))
                
                if captured_at >= cutoff_date:
                    snapshots.append(snapshot)
        except Exception as e:
            logger.error(f"Error loading snapshot {key}: {e}")
    
    logger.info(f"Found {len(snapshots)} snapshots for {slug} after cutoff date")
    
    if len(snapshots) < 2:
        return
    
    snapshots.sort(key=lambda x: x['captured_at'])
    
    generated_diffs = 0
    for i in range(len(snapshots) - 1):
        from_snapshot = snapshots[i]
        to_snapshot = snapshots[i + 1]
        
        diff_exists = check_diff_exists(slug, from_snapshot['id'], to_snapshot['id'], redis_client)
        
        if not diff_exists:
            logger.info(f"Generating diff: {from_snapshot['id'][:8]} -> {to_snapshot['id'][:8]}")
            
            try:
                response = requests.get(
                    f"{api_url}/diff/{slug}",
                    params={
                        'from': from_snapshot['id'],
                        'to': to_snapshot['id']
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    generated_diffs += 1
                    logger.info(f"Generated diff for {slug}")
                else:
                    logger.error(f"Failed to generate diff: {response.status_code}")
                    
            except Exception as e:
                logger.error(f"Error calling diff API: {e}")
    
    logger.info(f"Generated {generated_diffs} diffs for {slug}")


def check_diff_exists(slug: str, from_id: str, to_id: str, redis_client) -> bool:
    """Check if a diff already exists"""
    diff_keys = redis_client.zrange(f"diffs:{slug}", 0, -1)
    
    for key in diff_keys:
        try:
            import json
            diff_data = redis_client.get(key)
            if diff_data:
                diff = json.loads(diff_data)
                if diff['fromSnapshotId'] == from_id and diff['toSnapshotId'] == to_id:
                    return True
        except:
            pass
    
    return False


if __name__ == '__main__':
    backfill()