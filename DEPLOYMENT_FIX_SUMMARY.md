# Deployment Fix Summary

## ✅ Changes Made Locally

1. **Added runtime config to all API routes** that use `supabaseAdmin()`
   - Forces Node.js runtime (not Edge) where service role key is available
   - 21 routes updated with `export const runtime = 'nodejs';`

2. **Fixed wallet route** - Removed mock data, restored real economy query
   - File: `src/app/api/economy/wallet/route.ts`
   - Now fetches actual tokens/XP/level from `user_economy` table

3. **Fixed coverage table insert** - Now uses admin client to bypass RLS
   - File: `src/server/progression/quest.ts`
   - `user_mission_attempt_cards` insert uses `supabaseAdmin()` instead of user client

4. **Created deployment checklist** - `DEPLOYMENT_CHECKLIST.md`

## 🚀 Deployment Steps

### 1. Commit and Push Changes
\`\`\`bash
git add .
git commit -m "fix: Add runtime config for Node.js & restore real economy data

- Add runtime='nodejs' to all API routes using supabaseAdmin
- Remove mock wallet data, restore real economy query
- Fix user_mission_attempt_cards insert to use admin client
- Bypass RLS errors on coverage table
"
git push origin main
\`\`\`

### 2. Verify Environment Variables in Production

**CRITICAL:** Check your deployment platform (Vercel/Netlify/etc.) has these set:

\`\`\`bash
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # Service role key (NOT anon!)
NEXT_PUBLIC_SUPABASE_URL="https://doyyiylbwnusgxcaogok.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
NEXTAUTH_URL="https://your-production-domain.com"  # NOT localhost!
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_SECRET="..."
\`\`\`

### 3. Clear Build Cache & Redeploy

**On Vercel:**
- Go to: Settings > General > Build & Development Settings
- Click "Clear Build Cache"
- Trigger new deployment

**Or via CLI:**
\`\`\`bash
vercel --prod --force
\`\`\`

**On Netlify:**
- Go to: Site settings > Build & deploy > Clear cache and deploy

### 4. Verify Deployment

After deployment, test these endpoints:

1. **Wallet Data** - Should return real values (not mock):
   \`\`\`bash
   curl https://your-domain.com/api/economy/wallet \\
     -H "Cookie: your-session-cookie"
   # Should return actual tokens/xp/level from database
   \`\`\`

2. **Mission Complete** - Should log to database:
   \`\`\`bash
   # Complete a mission and check response
   # Should return attemptId (e.g., 113)
   \`\`\`

3. **Quest Progress** - Should show unlocked levels:
   \`\`\`bash
   curl https://your-domain.com/api/quest/42/progress \\
     -H "Cookie: your-session-cookie"
   # Should return cleared/unlocked status
   \`\`\`

### 5. Check Function Logs

**Vercel:**
\`\`\`bash
vercel logs --follow
\`\`\`

Or in dashboard: Deployments > [Your Deployment] > Functions > View Logs

**Look for:**
- ✅ "recordMissionAttempt.ok" with attemptId
- ✅ "Coverage per-card insert: { success: true }"
- ✅ No "401 Unauthorized" or "403 Forbidden" errors
- ✅ No "supabaseAdmin is not a function" errors

## 🐛 Troubleshooting

### If still not working:

1. **Check runtime logs** for actual error messages
2. **Verify `SUPABASE_SERVICE_ROLE_KEY`** is set (common mistake: using anon key instead)
3. **Check `NEXTAUTH_URL`** points to production domain, not localhost
4. **Force rebuild** with empty commit:
   \`\`\`bash
   git commit --allow-empty -m "Force rebuild"
   git push
   \`\`\`
5. **Check Supabase RLS policies** allow operations for authenticated users

### Common Issues:

| Issue | Fix |
|-------|-----|
| "Cannot find module" | Clear build cache, redeploy |
| "401 Unauthorized" | Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| "500 Internal Server Error" | Verify `SUPABASE_SERVICE_ROLE_KEY` is set |
| "supabaseAdmin is not a function" | Runtime must be 'nodejs', not 'edge' |
| Old code still running | Force rebuild with `--force` flag |

## 📊 Files Changed

- **21 API route files** - Added `export const runtime = 'nodejs';`
- **src/app/api/economy/wallet/route.ts** - Removed mock data
- **src/server/progression/quest.ts** - Use admin client for coverage insert
- **DEPLOYMENT_CHECKLIST.md** - Created deployment guide
- **scripts/add-runtime-config.sh** - Script to add runtime config (for future use)

## ✨ Expected Behavior After Fix

✅ Mission attempts save to database  
✅ Quest unlocking works correctly  
✅ Wallet displays real economy data  
✅ Coverage table inserts without RLS errors  
✅ No 403 Forbidden errors in logs  
✅ All quest progression features functional  
