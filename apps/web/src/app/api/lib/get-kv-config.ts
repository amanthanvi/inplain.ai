/**
 * KV Configuration Helper
 * Ensures proper loading of KV credentials in Edge runtime
 */

export function getKVConfig() {
  // Check all possible environment variable names that Vercel KV might set
  // When you connect a KV store in Vercel, it sets KV_URL, KV_REST_API_URL, and KV_REST_API_TOKEN
  const kvUrl = process.env.KV_REST_API_URL || 
                process.env.KV_URL ||
                process.env.UPSTASH_REDIS_REST_URL || 
                process.env.REDIS_URL;
                
  const kvToken = process.env.KV_REST_API_TOKEN || 
                  process.env.KV_REST_API_READ_ONLY_TOKEN ||
                  process.env.UPSTASH_REDIS_REST_TOKEN ||
                  process.env.KV_TOKEN ||
                  process.env.REDIS_TOKEN;

  // Enhanced debugging for production
  if (typeof window === 'undefined') {
    const debugInfo = {
      hasUrl: !!kvUrl,
      hasToken: !!kvToken,
      urlPrefix: kvUrl ? kvUrl.substring(0, 20) + '...' : 'none',
      tokenPrefix: kvToken ? kvToken.substring(0, 10) + '...' : 'none',
      env: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
      // Check which specific env vars are set
      envVarsChecked: {
        KV_REST_API_URL: !!process.env.KV_REST_API_URL,
        KV_URL: !!process.env.KV_URL,
        KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
        KV_REST_API_READ_ONLY_TOKEN: !!process.env.KV_REST_API_READ_ONLY_TOKEN
      }
    };
    
    console.log('KV Config Check:', debugInfo);
  }

  return { kvUrl, kvToken };
}