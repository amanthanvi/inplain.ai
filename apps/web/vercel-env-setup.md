# Vercel Environment Variables Setup - URGENT

## ⚠️ IMMEDIATE ACTION REQUIRED

Your app is failing in production because Clerk environment variables are not set in Vercel.

## Step 1: Add Clerk Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Click on "Settings" → "Environment Variables"
3. Add these variables **exactly as shown**:

### Required Variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Z2VudWluZS1jb2QtMTMuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_deexJgnrmQkTNWgf27xvjhiRT45anB70NiAcMC63BO
```

### Clerk Routing Variables (Add these to fix routing):
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

## Step 2: Important Settings for Each Variable

For **ALL** variables:
- Environment: Select "Production", "Preview", and "Development"
- For `CLERK_SECRET_KEY`: Check the "Sensitive" checkbox

## Step 3: Redeploy

After adding all variables:
1. Click "Save" for each variable
2. Go to the "Deployments" tab
3. Click the three dots on your latest deployment
4. Select "Redeploy"

## ⚠️ Production Keys Warning

You're currently using **development** Clerk keys. For production:

1. Go to https://dashboard.clerk.com
2. Select your PolicyDiff application
3. Navigate to "API Keys"
4. Copy the **Production** keys (they start with `pk_live_` and `sk_live_`)
5. Replace the test keys in Vercel with production keys

## Verification

After redeploying with the environment variables:
- The 500 errors on `/api/auth/session` should be resolved
- Authentication should work properly
- The development keys warning should disappear (if using production keys)