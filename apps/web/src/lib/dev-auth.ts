/**
 * Development-only authentication bypass for testing
 * WARNING: This should NEVER be used in production
 */

import { User } from './auth';

// Dev mode flag - only enabled in development
export const isDevAuthEnabled = () => {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
};

// Mock user for development
export const DEV_USER: User = {
  id: 'dev-user-123',
  email: 'dev@example.com',
  name: 'Development User',
  tier: 'enterprise', // Give full access in dev mode
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
  emailVerified: true,
  apiKey: 'dev-api-key-123',
  webhookUrl: 'https://webhook.site/dev-webhook',
  emailAlerts: true,
  alertFrequency: 'instant',
  customWatchlists: ['dev-watchlist-1', 'dev-watchlist-2'],
  usage: {
    apiCalls: 0,
    analysisCount: 0,
    lastReset: new Date()
  }
};

// Dev session token
export const DEV_SESSION_TOKEN = 'dev-session-token-bypass-123';

// Warning message for dev auth
export const DEV_AUTH_WARNING = {
  title: '⚠️ Development Authentication Active',
  message: 'Authentication is bypassed for development. This should NEVER appear in production.',
  details: [
    'All routes are accessible without login',
    'Using mock development user with enterprise tier',
    'API limits are disabled',
    'Data may be reset at any time'
  ]
};

// Log dev auth status
export function logDevAuthStatus() {
  if (isDevAuthEnabled()) {
    console.warn('🔓 DEV AUTH BYPASS ENABLED 🔓');
    console.warn('Authentication is bypassed for development testing');
    console.warn('Current user:', DEV_USER.email);
    console.warn('To disable, set NEXT_PUBLIC_DEV_AUTH_BYPASS=false');
  }
}

// Get dev auth headers for API requests
export function getDevAuthHeaders() {
  if (!isDevAuthEnabled()) return {};
  
  return {
    'X-Dev-Auth': 'true',
    'X-Dev-User-Id': DEV_USER.id,
    'X-Dev-User-Email': DEV_USER.email
  };
}

// Check if a request is using dev auth
export function isDevAuthRequest(headers: Headers): boolean {
  return headers.get('X-Dev-Auth') === 'true' && isDevAuthEnabled();
}