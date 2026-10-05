"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    return createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
              // Scopes the auth cookie to work on both draftthecast.com and
            // www.draftthecast.com, so sign-in doesn't break if someone starts
            // the flow on one and finishes it on the other.
            cookieOptions: process.env.NODE_ENV === "production" ? { domain: ".draftthecast.com" } : undefined,
      },
        );
}
