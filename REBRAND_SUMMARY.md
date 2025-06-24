# Inplain.AI Rebrand Summary

## ✅ Rebranding Complete!

All references to PolicyDiff have been successfully updated to **Inplain.AI**.

## 🔄 What Changed

### 1. **Package Names**
- `@policydiff/*` → `@inplain.ai/*`
- All internal imports updated

### 2. **Branding**
- Name: **Inplain.AI**
- Tagline: **"Privacy policies made simple"**
- Domain: **inplain.ai**

### 3. **Clerk Authentication**
- ✅ Production keys configured
- ✅ Custom domain: `clerk.inplain.ai`
- ✅ Frontend API URL: `https://clerk.inplain.ai`

### 4. **Files Updated**
- All `package.json` files
- UI components and pages
- Environment configuration
- Documentation (README.md)
- Build configuration
- API headers and metadata

## 📋 Action Items for You

### 1. **Vercel Configuration**

Add these environment variables in Vercel:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuaW5wbGFpbi5haSQ
CLERK_SECRET_KEY=sk_live_MN0UF5BuRbH0GcjVNY8ZJn4XKhQVndxUhWoU6YpahL
NEXT_PUBLIC_CLERK_DOMAIN=clerk.inplain.ai
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### 2. **Domain Setup**

In Vercel:
- Add custom domain: `inplain.ai`
- Configure DNS as per Vercel instructions

### 3. **Clerk DNS**

Add CNAME record:
- Name: `clerk`
- Value: [Get from Clerk dashboard]

### 4. **GitHub Repository** (Optional)

Consider renaming:
- From: `my_security_policy_app` or `policydiff`
- To: `inplain-ai`

### 5. **Deploy**

```bash
git add -A
git commit -m "Rebrand to Inplain.AI"
git push origin main
```

## 🎉 Your app will be live at https://inplain.ai

After completing the above steps, your rebranded privacy policy monitoring platform will be fully operational!