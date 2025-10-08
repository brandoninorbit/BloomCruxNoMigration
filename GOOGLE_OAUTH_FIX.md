# 🔐 Google OAuth Production Fix

## Problem Diagnosis
- ✅ Local (localhost:3000): Google login works
- ❌ Production (your-domain.com): Google login fails
- ❌ Production: Session is null → All API calls fail (401 Unauthorized)
- ⚠️  Email/password login works in production (proves auth system works)

**Root Cause**: Google OAuth redirect URLs not configured for production domain

## Fix Steps

### 1. Update Google Cloud Console OAuth Settings

Go to: https://console.cloud.google.com/apis/credentials

1. Find your OAuth 2.0 Client ID (check your `.env.local` for `GOOGLE_CLIENT_ID`)

2. Click to edit it

3. Under **Authorized JavaScript origins**, add:
   ```
   https://your-production-domain.com
   ```

4. Under **Authorized redirect URIs**, add:
   ```
   https://your-production-domain.com/auth/callback
   https://your-production-domain.com/api/auth/callback/google
   ```

   **Keep the localhost ones too** for local development:
   ```
   http://localhost:3000
   http://localhost:3000/auth/callback
   http://localhost:3000/api/auth/callback/google
   ```

5. Click **Save**

### 2. Verify Supabase OAuth Settings

Go to: https://supabase.com/dashboard/project/doyyiylbwnusgxcaogok/auth/providers

1. Find Google provider

2. Under **Redirect URLs**, ensure these are listed:
   ```
   https://your-production-domain.com/auth/callback
   https://doyyiylbwnusgxcaogok.supabase.co/auth/v1/callback
   ```

3. Click **Save**

### 3. Update Site URL in Supabase

Go to: https://supabase.com/dashboard/project/doyyiylbwnusgxcaogok/auth/url-configuration

1. Set **Site URL** to:
   ```
   https://your-production-domain.com
   ```

2. Under **Redirect URLs**, add:
   ```
   https://your-production-domain.com/**
   http://localhost:3000/**
   ```

3. Click **Save**

### 4. Verify Environment Variables

Already set correctly in Vercel (you did this):
- ✅ `NEXTAUTH_URL=https://your-production-domain.com`
- ✅ `GOOGLE_CLIENT_ID` (from your .env.local)
- ✅ `GOOGLE_CLIENT_SECRET` (from your .env.local)

### 5. Clear Cookies & Test

After making above changes:

1. **Clear all cookies** for your production domain
2. **Hard refresh** the page (Cmd+Shift+R / Ctrl+Shift+F5)
3. Try Google login again
4. Check `/api/debug/env-check` - session should NOT be null

## Quick Verification Checklist

- [ ] Google Cloud Console has production domain in Authorized origins
- [ ] Google Cloud Console has production callback URLs
- [ ] Supabase Auth has production Site URL set
- [ ] Supabase Auth has production redirect URLs
- [ ] `NEXTAUTH_URL` in Vercel = production URL (not localhost)
- [ ] Cookies cleared in production domain
- [ ] Hard refresh after changes

## Common Mistakes

1. ❌ Forgetting to add `/auth/callback` to redirect URIs
2. ❌ Using `http://` instead of `https://` for production
3. ❌ Forgetting to click **Save** in Google Console
4. ❌ Having old cookies cached
5. ❌ Waiting for DNS/config propagation (can take 5-10 min)

## Test After Fix

1. Go to: `https://your-production-domain.com`
2. Click "Sign in with Google"
3. Should redirect to Google → back to your site
4. Check: `https://your-production-domain.com/api/debug/env-check`
   - Should show: `"hasSession": true`
   - Should show: `"userId": "your-user-id"`
5. Check wallet: Should return real data (not null)
6. Complete mission: Should log to database

## If Still Not Working

Check browser console for errors:
- Look for CORS errors
- Look for redirect_uri_mismatch errors
- Check Network tab for failed OAuth requests

Get the exact error:
```bash
# Check Vercel function logs
vercel logs --follow
```

## Why This Fixes Everything

Session null → All authenticated APIs fail:
- ❌ `/api/economy/wallet` returns 401
- ❌ `/api/quest/*/complete` returns 401
- ❌ `/api/quest/*/progress` returns 401

Session valid → Everything works:
- ✅ Wallet loads real data
- ✅ Missions log to database
- ✅ Quest unlocking works
- ✅ All features functional
