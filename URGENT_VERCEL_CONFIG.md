# 🚨 URGENT: Vercel Configuration Updates Required

## 1. Build Command Fix ✅
The `vercel.json` has been updated to use the correct package name.

## 2. Update Clerk Environment Variables 🔴

You're still using **TEST** keys in Vercel! Update these immediately:

### In Vercel Dashboard > Environment Variables:

**UPDATE these existing variables:**

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuaW5wbGFpbi5haSQ
CLERK_SECRET_KEY=sk_live_MN0UF5BuRbH0GcjVNY8ZJn4XKhQVndxUhWoU6YpahL
```

**ADD this new variable:**

```
NEXT_PUBLIC_CLERK_DOMAIN=clerk.inplain.ai
```

### Current Issue:
- ❌ Using `pk_test_` key (development)
- ❌ Using `sk_test_` key (development)
- ✅ Should use `pk_live_` key (production)
- ✅ Should use `sk_live_` key (production)

## 3. Alternatively: Update Build Command in Vercel UI

If the build still fails, you can also update the build command directly in Vercel:

1. Go to Settings > General
2. Under "Build & Development Settings"
3. Change Build Command from:
   ```
   cd ../.. && npm run build -- --filter=@policydiff/web
   ```
   To:
   ```
   cd ../.. && npm run build -- --filter=@inplain.ai/web
   ```

## 4. Domain Configuration

Make sure you've added `inplain.ai` to your Vercel domains.

## Next Steps:
1. Update the Clerk environment variables to production keys
2. Redeploy
3. Your site will be live at https://inplain.ai!

---

**Note**: The build is failing because it's looking for `@policydiff/web` but we've renamed it to `@inplain.ai/web`. The vercel.json has been fixed, but you may need to push this change or update it in the Vercel UI.