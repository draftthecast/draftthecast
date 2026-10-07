import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { adminViewOn, isAdmin } from "@/lib/viewMode";
import LeagueApp from "./LeagueApp";

export const metadata: Metadata = { title: "League", robots: { index: false, follow: false } };

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUser();
  if (!user) redirect("/");

  const adminView = await adminViewOn(await isAdmin(supabase, user.id));
  const { data: league } = await supabase.from("leagues").select("id").eq("id", id).maybeSingle();
  const { data: mine } = await supabase.from("league_members").select("id").eq("league_id", id).eq("user_id", user.id).maybeSingle();
  // In player view, an admin sees exactly what a non-member would.
  if (!league || (!mine && !adminView)) {
    return (
      <main className="empty">
        <b>You&apos;re not in this league</b>
        <span>Ask the commissioner for the invite link, then open it to join.</span>
      </main>
    );
  }
  return <LeagueApp leagueId={id} userId={user.id} isSiteAdmin={adminView} />;
}
