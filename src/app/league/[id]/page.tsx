import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import LeagueApp from "./LeagueApp";

export const metadata: Metadata = { title: "League" };

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUser();
  if (!user) redirect("/");

  const { data: league } = await supabase.from("leagues").select("id").eq("id", id).maybeSingle();
  if (!league) {
    return (
      <main className="empty">
        <b>You&apos;re not in this league</b>
        <span>Ask the commissioner for the invite link, then open it to join.</span>
      </main>
    );
  }
  const { data: admin } = await supabase.from("site_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return <LeagueApp leagueId={id} userId={user.id} isSiteAdmin={!!admin} />;
}
