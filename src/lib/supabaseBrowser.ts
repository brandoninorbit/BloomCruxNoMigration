// Deprecated: use getSupabaseClient from '@/lib/supabase/browserClient'.
// This file now delegates to the unified client that disables auto-refresh
// to prevent "Invalid Refresh Token: Already Used" errors.
import { getSupabaseClient } from '@/lib/supabase/browserClient'

export const supabase = getSupabaseClient()
