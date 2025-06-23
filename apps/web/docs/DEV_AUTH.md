# Development Authentication Bypass

This feature provides a convenient way to bypass authentication during development for testing purposes.

## ⚠️ IMPORTANT SECURITY WARNING

**This feature should NEVER be enabled in production!** It completely bypasses all authentication and authorization checks.

## Features

- Automatic login with a development user (enterprise tier)
- No password required
- Full access to all premium features
- Visual warning banner when active
- Console warnings on every auth check
- Special headers to identify dev auth requests

## How to Use

### Enable Dev Auth

```bash
npm run dev:auth:on
```

This will:
- Set `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in `.env.local`
- Show confirmation and dev user details
- Remind you to restart the dev server

### Disable Dev Auth

```bash
npm run dev:auth:off
```

This will:
- Remove the bypass setting from `.env.local`
- Restore normal authentication requirements
- Remind you to restart the dev server

### Manual Setup

You can also manually set the environment variable:

```bash
# In .env.local
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
```

## Dev User Details

When dev auth is enabled, you're automatically logged in as:

- **Email**: dev@example.com
- **Name**: Development User
- **Tier**: Enterprise (full access)
- **User ID**: dev-user-123
- **API Key**: dev-api-key-123

## Visual Indicators

When dev auth is active, you'll see:

1. **Yellow Warning Banner**: A prominent banner at the top of the page
2. **Console Warnings**: Warnings in the browser and server console
3. **Response Headers**: Special headers indicating dev auth is active

## How It Works

1. The middleware checks for the `NEXT_PUBLIC_DEV_AUTH_BYPASS` environment variable
2. If enabled and in development mode, it bypasses JWT verification
3. A mock development user is returned for all auth checks
4. The development user has enterprise tier access to all features

## Testing with Dev Auth

Dev auth is useful for:

- Testing premium features without a subscription
- Debugging authentication flows
- Running automated tests
- Demonstrating features without login

## API Testing

When making API requests with dev auth enabled:

```bash
# No authentication headers needed!
curl http://localhost:3000/api/user/settings

# Or with explicit dev auth headers
curl http://localhost:3000/api/user/settings \
  -H "X-Dev-Auth: true" \
  -H "X-Dev-User-Id: dev-user-123"
```

## Debug Endpoint

Check dev auth status:

```bash
curl http://localhost:3000/api/debug/dev-auth
```

## Security Measures

- Only works when `NODE_ENV=development`
- Requires explicit opt-in via environment variable
- Shows prominent visual warnings
- Logs all dev auth usage
- Cannot be enabled in production builds

## Troubleshooting

### Dev auth not working?

1. Check that `NODE_ENV=development`
2. Verify `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in `.env.local`
3. Restart your development server
4. Check the console for error messages

### Still seeing login screen?

1. Clear your browser cookies
2. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
3. Check the browser console for errors

### Want to test real authentication?

Simply run:

```bash
npm run dev:auth:off
```

Then restart your development server.