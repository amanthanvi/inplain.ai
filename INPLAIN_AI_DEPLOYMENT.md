# Inplain.AI Deployment Guide

## 🎉 Rebranding Complete!

All references to PolicyDiff have been updated to **Inplain.AI**.

## 📋 Required Actions for Deployment

### 1. **Vercel Environment Variables**

Add these environment variables to your Vercel project:

```bash
# Clerk Production Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuaW5wbGFpbi5haSQ
CLERK_SECRET_KEY=sk_live_MN0UF5BuRbH0GcjVNY8ZJn4XKhQVndxUhWoU6YpahL

# Clerk Custom Domain
NEXT_PUBLIC_CLERK_DOMAIN=clerk.inplain.ai

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Keep your existing Upstash Redis variables
UPSTASH_REDIS_REST_URL=[your-existing-value]
UPSTASH_REDIS_REST_TOKEN=[your-existing-value]

# Optional: Add these for full functionality
OPENAI_API_KEY=[your-api-key]
ANTHROPIC_API_KEY=[your-api-key]
```

### 2. **Vercel Domain Configuration**

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add `inplain.ai` as your custom domain
4. Follow Vercel's instructions to update your DNS records

### 3. **Update GitHub Repository**

1. Rename your repository from `policydiff` to `inplain-ai` (optional but recommended)
2. Update the repository description to: "AI-powered privacy policy monitoring and analysis"
3. Update the website field to: `https://inplain.ai`

### 4. **Clerk Configuration**

The following Clerk settings are already configured in your code:
- Frontend API URL: `https://clerk.inplain.ai`
- Backend API URL: `https://api.clerk.com`
- Custom domain: `clerk.inplain.ai`

Make sure your Clerk dashboard has:
1. Production instance activated
2. Custom domain `clerk.inplain.ai` configured
3. Allowed callback URLs include:
   - `https://inplain.ai/*`
   - `https://www.inplain.ai/*`

### 5. **DNS Records for Clerk Custom Domain**

Add these DNS records for `clerk.inplain.ai`:
- Type: CNAME
- Name: clerk
- Value: [Provided by Clerk in your dashboard]

## 🚀 Deployment Steps

1. **Commit and push changes:**
   ```bash
   git add -A
   git commit -m "Rebrand to Inplain.AI"
   git push origin main
   ```

2. **In Vercel:**
   - Add all environment variables listed above
   - Add custom domain `inplain.ai`
   - Redeploy

3. **DNS Configuration:**
   - Point `inplain.ai` to Vercel
   - Configure `clerk.inplain.ai` subdomain

## ✅ What's Been Updated

- **Branding:** All references changed from PolicyDiff to Inplain.AI
- **Package names:** Updated to @inplain.ai/* namespace
- **Metadata:** Updated titles, descriptions, and OpenGraph tags
- **Clerk:** Production keys configured with custom domain
- **URLs:** Updated all hardcoded URLs to use inplain.ai

## 🔍 Verification Checklist

After deployment, verify:
- [ ] Site loads at https://inplain.ai
- [ ] Authentication works (sign up, sign in)
- [ ] Clerk uses clerk.inplain.ai domain
- [ ] No "PolicyDiff" references visible
- [ ] API endpoints work correctly
- [ ] Activity feed shows real data

## 📝 Notes

- The app uses **production** Clerk keys now, not development keys
- Custom domain setup may take up to 24 hours for DNS propagation
- SSL certificates will be automatically provisioned by Vercel

## 🆘 Troubleshooting

If authentication fails:
1. Verify all Clerk environment variables are set in Vercel
2. Check that clerk.inplain.ai DNS is configured
3. Ensure Clerk dashboard has production instance activated

If domain doesn't work:
1. Verify DNS records are properly configured
2. Wait for DNS propagation (up to 24 hours)
3. Check Vercel domain settings

---

**Your new site will be live at: https://inplain.ai** 🎉