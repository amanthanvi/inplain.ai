/**
 * Environment initialization for server-side code
 * This should be imported at the top of any server-side entry points
 */

import { validateEnvConfig, getEnvStatus } from './env'

// Only run validation on the server
if (typeof window === 'undefined') {
  try {
    validateEnvConfig()
    
    const status = getEnvStatus()
    
    // Log environment status on startup
    console.log('[ENV] Application mode:', status.mode)
    
    if (status.warnings.length > 0) {
      console.warn('[ENV] Warnings:', status.warnings)
    }
    
    if (status.missingOptional.length > 0) {
      console.info('[ENV] Optional variables not set:', status.missingOptional)
    }
    
    // Log feature availability
    console.log('[ENV] Features:', {
      ai: status.mode !== 'demo' ? 'enabled' : 'demo mode',
      storage: status.missingOptional.includes('KV_REST_API_URL') ? 'local' : 'persistent',
      webhooks: !status.missingOptional.includes('BLOB_READ_WRITE_TOKEN') ? 'enabled' : 'disabled'
    })
  } catch (error) {
    console.error('[ENV] Fatal configuration error:', error)
    throw error
  }
}

export default true