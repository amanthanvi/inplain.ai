#!/usr/bin/env python3
import sys
import csv
import time
import logging
from datetime import datetime
from typing import List, Dict

from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
import redis
import click

from spiders.policy_spider import PolicySpider

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


@click.command()
@click.option('--sources', type=click.Path(exists=True), help='CSV file with company URLs')
@click.option('--urls', type=str, help='Comma-separated list of URLs to crawl')
@click.option('--continuous', is_flag=True, help='Run continuously, checking queue')
@click.option('--interval', type=int, default=3600, help='Check interval in seconds (for continuous mode)')
def main(sources: str, urls: str, continuous: bool, interval: int):
    """Inplain.AI Scraper - Fetches and stores policy pages"""
    
    if not sources and not urls and not continuous:
        click.echo("Error: Provide either --sources, --urls, or --continuous flag")
        sys.exit(1)
    
    if continuous:
        run_continuous(interval)
    elif sources:
        urls_list = load_urls_from_csv(sources)
        run_spider(urls_list)
    elif urls:
        urls_list = [u.strip() for u in urls.split(',')]
        run_spider(urls_list)


def load_urls_from_csv(filepath: str) -> List[str]:
    """Load URLs from CSV file"""
    urls = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('active', 'true').lower() == 'true':
                    urls.append(row['url'])
        logger.info(f"Loaded {len(urls)} URLs from {filepath}")
    except Exception as e:
        logger.error(f"Error loading CSV: {e}")
        sys.exit(1)
    return urls


def run_spider(urls: List[str]):
    """Run spider with given URLs"""
    if not urls:
        logger.warning("No URLs to crawl")
        return
    
    settings = get_project_settings()
    process = CrawlerProcess(settings)
    
    process.crawl(
        PolicySpider,
        urls=','.join(urls)
    )
    
    logger.info(f"Starting crawl for {len(urls)} URLs")
    process.start()
    logger.info("Crawl completed")


def run_continuous(interval: int):
    """Run continuously, checking for new crawl jobs"""
    logger.info(f"Starting continuous mode with {interval}s interval")
    
    settings = get_project_settings()
    redis_client = redis.from_url(settings.get('REDIS_URL'), decode_responses=True)
    
    while True:
        try:
            companies = get_companies_to_check(redis_client)
            
            if companies:
                logger.info(f"Found {len(companies)} companies to check")
                urls = [c['url'] for c in companies]
                
                process = CrawlerProcess(settings)
                process.crawl(PolicySpider, urls=','.join(urls))
                process.start(stop_after_crawl=True)
                
                update_last_checked(redis_client, companies)
            else:
                logger.info("No companies need checking")
            
            logger.info(f"Sleeping for {interval} seconds...")
            time.sleep(interval)
            
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Error in continuous mode: {e}")
            time.sleep(60)


def get_companies_to_check(redis_client) -> List[Dict]:
    """Get companies that need checking"""
    companies = []
    
    try:
        companies_data = redis_client.get('companies:active')
        if not companies_data:
            return []
        
        import json
        all_companies = json.loads(companies_data)
        
        now = datetime.utcnow()
        for company in all_companies:
            if not company.get('active', True):
                continue
            
            last_checked = company.get('lastChecked')
            check_interval = company.get('checkInterval', 3600)
            
            if not last_checked:
                companies.append(company)
            else:
                last_checked_dt = datetime.fromisoformat(last_checked.replace('Z', '+00:00'))
                seconds_since_check = (now - last_checked_dt).total_seconds()
                
                if seconds_since_check >= check_interval:
                    companies.append(company)
    
    except Exception as e:
        logger.error(f"Error getting companies: {e}")
    
    return companies


def update_last_checked(redis_client, companies: List[Dict]):
    """Update last checked timestamp for companies"""
    try:
        companies_data = redis_client.get('companies:active')
        if not companies_data:
            return
        
        import json
        all_companies = json.loads(companies_data)
        
        checked_slugs = {c['slug'] for c in companies}
        now = datetime.utcnow().isoformat() + 'Z'
        
        for company in all_companies:
            if company['slug'] in checked_slugs:
                company['lastChecked'] = now
        
        redis_client.set('companies:active', json.dumps(all_companies))
        
    except Exception as e:
        logger.error(f"Error updating last checked: {e}")


if __name__ == '__main__':
    main()