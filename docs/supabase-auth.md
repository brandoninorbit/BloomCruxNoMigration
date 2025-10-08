Supabase auth flows (browser vs server)

Purpose

This project uses two distinct Supabase auth clients:

- Browser/client components: `getSupabaseClient()` from `src/lib/supabase/browserClient.ts`. This uses the public anon key and a client-side access token. Client components should use the Authorization header (Bearer <access_token>) when calling internal API routes.
- Server components & API routes: `supabaseAdmin()` (server-only) or `createServerClient()` where appropriate. Server code uses the service role key or server-side session cookies.

Why this matters

- Many server API routes (for example `src/app/api/economy/wallet/route.ts`) rely on reading the Supabase session from cookies via `next/headers()` and `createServerClient()`. Those routes run with server context and Row Level Security (RLS) in Postgres will scope results by `auth.uid()` when the session is present.
- When a server component or server-side page needs to call an internal API route (same-origin), the call must include the user's session cookie so the API route can read it. If the cookie is omitted, the API route sees no session and returns unauthorized or empty results.

fetchWithAuth helper

To centralize this behavior we provide `src/lib/supabase/fetchWithAuth.ts`:

- Client-side (browser): fetchWithAuth attaches `Authorization: Bearer <access_token>` when available and sets `credentials: 'same-origin'` so cookies are sent for same-origin requests.
- Server-side (server components / SSR): fetchWithAuth reconstructs a `cookie` header from `next/headers().getAll()` and attaches it to the outgoing fetch. This ensures internal API routes that call `getSupabaseSession()` can access the session and run RLS-scoped queries correctly.

Notes & troubleshooting

- Do not mix client and server Supabase auth helpers. Use `getSupabaseClient()` in client components and `supabaseAdmin()` or `createServerClient()` in server code.
- If you see blank or zeroed `user_economy` data in production, confirm that server-side calls to internal API routes are forwarding cookies (use `fetchWithAuth`), and confirm your deployment preserves same-origin behavior for server-to-server fetches.
- Tests: there are unit tests validating `fetchWithAuth` and an integration-style test that mocks `getSupabaseSession` and `supabaseAdmin` to verify the full path for `GET /api/economy/wallet`.
