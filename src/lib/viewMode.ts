import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Site admins can switch to "player view" to see the site the way everyone else does.
// This only changes what the pages show; the database still recognizes the admin.
export const VIEW_COOKIE = "dtc_view";

export async function adminViewOn(isSiteAdmin: boolean): Promise<boolean> {
  if (!isSiteAdmin) return false;
  return (await cookies()).get(VIEW_COOKIE)?.value !== "player";
}

export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("site_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}
