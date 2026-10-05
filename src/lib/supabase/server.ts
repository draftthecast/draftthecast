import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
              // Scopes the auth cookie to work on both draftthecast.com and
            // www.draftthecast.com, so sign-in doesn't break if someone starts
            // the flow on one and finishes it on the other.
            cookieOptions: process.env.NODE_ENV === "production" ? { domain: ".draftthecast.com" } : undefined,
              cookies: {
                        getAll() {
                                    return cookieStore.getAll();
                        },
                        setAll(cookiesToSet) {
                                    try {
                                                  cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                                    } catch {
                                                  // Called from a Server Component, where cookies are read-only. The proxy refreshes sessions.
                                    }
                        },
              },
      },
        );
}

export async function getUser() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data.user };
}
