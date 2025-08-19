// src/lib/auth.ts (NextAuth v4-compatible helpers)
import NextAuth, { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { getServerSession } from "next-auth/next";

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
};

// Helper used in app route handlers
export const auth = () => getServerSession(authOptions);

// Default export handler for /api/auth/[...nextauth]
export default NextAuth(authOptions);