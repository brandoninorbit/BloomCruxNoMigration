# Deployment Checklist for BloomCrux

## Critical Environment Variables

Ensure these are set in your deployment platform (Vercel/Netlify/etc.):

### Required for Server-Side Operations
```bash
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
NEXT_PUBLIC_SUPABASE_URL="https://doyyiylbwnusgxcaogok.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Required for OAuth (if using Google login)
```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"
```

## Deployment Steps

### 1. Verify Environment Variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (NOT the anon key!)
- [ ] All `NEXT_PUBLIC_*` variables are set
- [ ] `NEXTAUTH_URL` points to production domain (not localhost)

### 2. Clear Build Cache
On Vercel:
```bash
# In project settings, go to: Settings > General > Build & Development Settings
# Click "Clear Build Cache"
```

Or use Vercel CLI:
```bash
vercel --prod --force
```

### 3. Verify Supabase RLS Policies
Check that these policies exist:
- `user_deck_mission_attempts` - allow INSERT/SELECT for authenticated users
- `user_deck_mission_card_answers` - allow INSERT/SELECT for authenticated users
- `user_mission_attempt_cards` - allow INSERT/SELECT for authenticated users (or use admin client)
- `user_economy` - allow SELECT/UPDATE for authenticated users

### 4. Check Runtime Configuration
Ensure API routes use Node.js runtime (not Edge):
```typescript
// Add to routes that need service role key:
export const runtime = 'nodejs'; // Required for supabaseAdmin()
```

### 5. Verify Database Migrations
Run all migrations against production database:
```bash
node scripts/run-sql.js supabase/migrations/20251008_user_mission_attempt_cards_rls.sql
```

## Common Issues & Fixes

### Issue: "Cannot find module" or "supabaseAdmin is not a function"
**Fix:** Clear build cache and redeploy

### Issue: "401 Unauthorized" on all API calls
**Fix:** Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly

### Issue: "500 Internal Server Error" on wallet/quest endpoints
**Fix:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set (NOT anon key)

### Issue: Data persists locally but not in production
**Fix:** 
1. Check environment variables
2. Clear build cache
3. Verify Supabase connection from production logs
4. Check RLS policies allow the operations

### Issue: Old code running in production
**Fix:**
```bash
# Force rebuild
git commit --allow-empty -m "Force rebuild"
git push
```

## Verification Steps

After deployment:
1. [ ] Open browser DevTools > Network tab
2. [ ] Complete a mission
3. [ ] Check `/api/quest/[deckId]/complete` returns 200 with attemptId
4. [ ] Check `/api/economy/wallet` returns real data (not mock)
5. [ ] Check Supabase dashboard for new rows in `user_deck_mission_attempts`
6. [ ] Verify quest unlocking works (next Bloom level accessible)

## Debug Production Issues

### Enable verbose logging
Add to affected API routes:
```typescript
console.log('ENV CHECK:', {
  hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  nodeEnv: process.env.NODE_ENV
});
```

### Check Vercel Function Logs
```bash
vercel logs --follow
```

Or in Vercel dashboard: Deployments > [Your Deployment] > Functions > View Logs

## Emergency Rollback

If deployment breaks:
```bash
# Revert to last working commit
git revert HEAD
git push

# Or rollback in Vercel dashboard
```
