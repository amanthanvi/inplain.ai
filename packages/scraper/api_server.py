"""
API Server for Privacy Policy Scraper
Provides REST API endpoints for the Vercel frontend to trigger scraping jobs
"""

import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
from dotenv import load_dotenv

from spiders.policy_spider import PolicySpider

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS - only allow requests from Vercel frontend
ALLOWED_ORIGINS = [
    os.getenv('FRONTEND_URL', 'https://inplain.ai'),
    'http://localhost:3000',  # Development
]
CORS(app, origins=ALLOWED_ORIGINS)

# Initialize Redis client for job queue
redis_url = os.getenv('REDIS_URL')
if redis_url:
    # Use Redis URL (for Render/Upstash)
    redis_client = redis.from_url(redis_url, decode_responses=True)
else:
    # Use individual settings (for Railway)
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        password=os.getenv('REDIS_PASSWORD'),
        decode_responses=True
    )

# Thread pool for running scrapers
executor = ThreadPoolExecutor(max_workers=5)

# API Key validation
API_KEY = os.getenv('SCRAPER_API_KEY', 'development-key')

def validate_api_key():
    """Validate API key from request headers"""
    api_key = request.headers.get('X-API-Key')
    if api_key != API_KEY:
        return False
    return True

@app.before_request
def check_api_key():
    """Check API key before processing requests"""
    if request.path == '/health':
        return  # Skip auth for health check
    
    if not validate_api_key():
        return jsonify({'error': 'Unauthorized'}), 401

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Railway"""
    try:
        # Check Redis connection
        redis_client.ping()
        redis_status = 'healthy'
    except:
        redis_status = 'unhealthy'
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'services': {
            'redis': redis_status
        }
    })

@app.route('/scrape', methods=['POST'])
def trigger_scrape():
    """Trigger a scraping job for a specific company"""
    try:
        data = request.json
        company_slug = data.get('slug')
        url = data.get('url')
        priority = data.get('priority', 'normal')
        
        if not company_slug or not url:
            return jsonify({'error': 'Missing required fields: slug and url'}), 400
        
        # Create job ID
        job_id = f"scrape_{company_slug}_{datetime.utcnow().timestamp()}"
        
        # Store job in Redis
        job_data = {
            'id': job_id,
            'slug': company_slug,
            'url': url,
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat(),
            'priority': priority
        }
        
        redis_client.setex(
            f"job:{job_id}",
            3600,  # 1 hour TTL
            json.dumps(job_data)
        )
        
        # Add to job queue
        queue_key = 'scraper:queue:high' if priority == 'high' else 'scraper:queue:normal'
        redis_client.lpush(queue_key, job_id)
        
        # Submit scraping task to executor
        executor.submit(run_scrape_job, job_id, company_slug, url)
        
        return jsonify({
            'job_id': job_id,
            'status': 'queued',
            'message': f'Scraping job queued for {company_slug}'
        }), 202
        
    except Exception as e:
        logger.error(f"Error triggering scrape: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/scrape/batch', methods=['POST'])
def trigger_batch_scrape():
    """Trigger scraping jobs for multiple companies"""
    try:
        data = request.json
        companies = data.get('companies', [])
        
        if not companies:
            return jsonify({'error': 'No companies provided'}), 400
        
        job_ids = []
        
        for company in companies:
            slug = company.get('slug')
            url = company.get('url')
            
            if not slug or not url:
                continue
            
            # Create job ID
            job_id = f"scrape_{slug}_{datetime.utcnow().timestamp()}"
            
            # Store job in Redis
            job_data = {
                'id': job_id,
                'slug': slug,
                'url': url,
                'status': 'pending',
                'created_at': datetime.utcnow().isoformat(),
                'batch': True
            }
            
            redis_client.setex(
                f"job:{job_id}",
                3600,
                json.dumps(job_data)
            )
            
            # Add to job queue
            redis_client.lpush('scraper:queue:normal', job_id)
            job_ids.append(job_id)
            
            # Submit scraping task
            executor.submit(run_scrape_job, job_id, slug, url)
        
        return jsonify({
            'job_ids': job_ids,
            'count': len(job_ids),
            'status': 'queued'
        }), 202
        
    except Exception as e:
        logger.error(f"Error triggering batch scrape: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get the status of a scraping job"""
    try:
        job_data = redis_client.get(f"job:{job_id}")
        
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404
        
        job = json.loads(job_data)
        
        # Check for result
        result_data = redis_client.get(f"result:{job_id}")
        if result_data:
            job['result'] = json.loads(result_data)
        
        return jsonify(job)
        
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/results/<company_slug>', methods=['GET'])
def get_latest_results(company_slug):
    """Get the latest scraping results for a company"""
    try:
        # Get latest result from Redis
        result_key = f"latest_result:{company_slug}"
        result_data = redis_client.get(result_key)
        
        if not result_data:
            return jsonify({'error': 'No results found'}), 404
        
        result = json.loads(result_data)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting results: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def run_scrape_job(job_id: str, company_slug: str, url: str):
    """Run a scraping job in a separate thread"""
    try:
        logger.info(f"Starting scrape job {job_id} for {company_slug}")
        
        # Update job status
        job_data = json.loads(redis_client.get(f"job:{job_id}"))
        job_data['status'] = 'running'
        job_data['started_at'] = datetime.utcnow().isoformat()
        redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
        
        # Run the scraper
        from scrapy.crawler import CrawlerRunner
        from scrapy.utils.project import get_project_settings
        from twisted.internet import reactor, defer
        
        # Configure settings
        settings = get_project_settings()
        settings.set('LOG_LEVEL', 'INFO')
        
        # Create runner
        runner = CrawlerRunner(settings)
        
        # Run spider
        deferred = runner.crawl(
            PolicySpider,
            company_slug=company_slug,
            start_urls=[url]
        )
        
        # Handle completion
        def on_success(result):
            logger.info(f"Scrape job {job_id} completed successfully")
            
            # Update job status
            job_data['status'] = 'completed'
            job_data['completed_at'] = datetime.utcnow().isoformat()
            redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
            
            # Store result
            result_data = {
                'job_id': job_id,
                'company_slug': company_slug,
                'url': url,
                'scraped_at': datetime.utcnow().isoformat(),
                'content': result
            }
            
            # Store in Redis with TTL
            redis_client.setex(
                f"result:{job_id}",
                86400,  # 24 hours
                json.dumps(result_data)
            )
            
            # Also store as latest for the company
            redis_client.setex(
                f"latest_result:{company_slug}",
                86400,
                json.dumps(result_data)
            )
            
            # Notify frontend via webhook if configured
            webhook_url = os.getenv('FRONTEND_WEBHOOK_URL')
            if webhook_url:
                notify_frontend(webhook_url, job_id, 'completed', result_data)
        
        def on_error(failure):
            logger.error(f"Scrape job {job_id} failed: {failure}")
            
            # Update job status
            job_data['status'] = 'failed'
            job_data['error'] = str(failure)
            job_data['failed_at'] = datetime.utcnow().isoformat()
            redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))
            
            # Notify frontend
            webhook_url = os.getenv('FRONTEND_WEBHOOK_URL')
            if webhook_url:
                notify_frontend(webhook_url, job_id, 'failed', {'error': str(failure)})
        
        deferred.addCallback(on_success)
        deferred.addErrback(on_error)
        
        # Run reactor if not already running
        if not reactor.running:
            reactor.run()
            
    except Exception as e:
        logger.error(f"Error running scrape job {job_id}: {str(e)}")
        
        # Update job status
        job_data = json.loads(redis_client.get(f"job:{job_id}"))
        job_data['status'] = 'failed'
        job_data['error'] = str(e)
        redis_client.setex(f"job:{job_id}", 3600, json.dumps(job_data))

def notify_frontend(webhook_url: str, job_id: str, status: str, data: Dict[str, Any]):
    """Notify frontend via webhook"""
    try:
        import requests
        
        payload = {
            'job_id': job_id,
            'status': status,
            'timestamp': datetime.utcnow().isoformat(),
            'data': data
        }
        
        headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        }
        
        response = requests.post(
            webhook_url,
            json=payload,
            headers=headers,
            timeout=5
        )
        
        if response.status_code != 200:
            logger.warning(f"Webhook notification failed: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error notifying frontend: {str(e)}")

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port)