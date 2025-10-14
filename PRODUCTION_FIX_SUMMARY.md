# 🔍 Production Issue: Root Cause Found!

## The Real Problem

**Session is NULL in production** → All authenticated APIs fail

### Why It Happens

1. ❌ Google OAuth redirect URLs not configured for production domain
2. ✅ Email/password login works (proves auth system is functional)
3. ❌ Google login fails → No session created → APIs return 401

### The Fix (3 Steps - Takes 5 minutes)

#### Step 1: Google Cloud Console
**Go to**: https://console.cloud.google.com/apis/credentials

1. Find your OAuth 2.0 Client ID (the one in your `.env.local` under `GOOGLE_CLIENT_ID`)
2. Click edit
3. Under **Authorized JavaScript origins**, add:
   ```
   https://your-actual-production-domain.com
   ```
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-actual-production-domain.com/auth/callback
   https://your-actual-production-domain.com/api/auth/callback/google
   ```
5. **IMPORTANT**: Keep localhost URLs too!
6. Click **Save**

#### Step 2: Supabase Dashboard
**Go to**: https://supabase.com/dashboard/project/doyyiylbwnusgxcaogok/auth/url-configuration

1. Set **Site URL** to: `https://your-actual-production-domain.com`
2. Under **Redirect URLs**, add: `https://your-actual-production-domain.com/**`
3. Click **Save**

#### Step 3: Test
1. **Clear all cookies** for your production domain
2. **Hard refresh** (Cmd+Shift+R or Ctrl+Shift+F5)
3. Try Google login
4. ✅ Should work now!

### How to Verify Fix Worked

1. **Check session**:
   ```
   https://your-domain.com/api/debug/env-check
   ```
   Should show: `"hasSession": true`

2. **Check wallet**:
   ```
   https://your-domain.com/api/economy/wallet
   ```
   Should return real tokens/XP (not 401 error)

3. **Complete a mission**:
   Should log to database successfully

### Why Everything Was Broken

```
No session → All API routes fail:
├── /api/economy/wallet → 401 Unauthorized
├── /api/quest/*/complete → 401 Unauthorized  
├── /api/quest/*/progress → 401 Unauthorized
└── All features broken
```

```
Session valid → Everything works:
├── /api/economy/wallet → ✅ Real data
├── /api/quest/*/complete → ✅ Logs to DB
├── /api/quest/*/progress → ✅ Shows unlocks
└── All features work perfectly
```

## Why Localhost Works But Production Doesn't

- **Localhost**: Google OAuth configured with `http://localhost:3000` ✅
- **Production**: Google OAuth missing `https://your-domain.com` ❌

Google rejects login attempts from unauthorized domains!

## Additional Debug Commands

If still having issues:

```bash
# Check Vercel logs
vercel logs --follow

# Test debug endpoint
curl https://your-domain.com/api/debug/env-check

# Check session in browser console
fetch('/api/auth/session').then(r => r.json()).then(console.log)
```

## Summary

**This wasn't a code issue** - your code is perfect! 

**This was a configuration issue** - OAuth redirect URLs need your production domain.

After fixing OAuth settings, session will be valid → All features will work! 🎉
