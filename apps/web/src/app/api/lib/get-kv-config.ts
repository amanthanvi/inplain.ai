/**
 * KV Configuration Helper
 * Ensures proper loading of KV credentials in Edge runtime
 */

export function getKVConfig() {
  // Try multiple environment variable names for better compatibility
  const kvUrl = process.env.KV_REST_API_URL || 
                process.env.UPSTASH_REDIS_REST_URL || 
                process.env.KV_URL ||
                process.env.REDIS_URL;
                
  const kvToken = process.env.KV_REST_API_TOKEN || 
                  process.env.UPSTASH_REDIS_REST_TOKEN ||
                  process.env.KV_TOKEN ||
                  process.env.REDIS_TOKEN;

  // Log the configuration status for debugging
  if (typeof window === 'undefined') {
    console.log('KV Config Check:', {
      hasUrl: !!kvUrl,
      hasToken: !!kvToken,
      urlPrefix: kvUrl ? kvUrl.substring(0, 20) + '...' : 'none',
      tokenPrefix: kvToken ? kvToken.substring(0, 10) + '...' : 'none',
      env: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV
    });
  }

  return { kvUrl, kvToken };
}