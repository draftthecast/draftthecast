import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import SignInButton from "@/components/SignInButton";
import JoinForm from "./JoinForm";

export const metadata: Metadata = { title: "Join a league" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { supabase, user } = await getUser();
  const { data } = await supabase.rpc("league_preview", { p_code: code });
  const league = (data as { id: string; name: string; season_title: string; member_count: number; draft_status: string; mode: string }[] | null)?.[0];

  if (!league) {
    return (
      <main className="empty">
        <b>That invite doesn&apos;t match a league</b>
        <span>Check the link or code with whoever sent it.</span>
      </main>
    );
  }

  if (user) {
    const { data: mine } = await supabase.from("league_members").select("id").eq("league_id", league.id).eq("user_id", user.id).maybeSingle();
    if (mine) redirect(`/league/${league.id}`);
  }

  const closed = league.mode === "snake" && league.draft_status !== "setup";

  return (
    <main className="section" style={{ gap: 20 }}>
      <section className="hero">
        <span className="showtag" style={{ alignSelf: "flex-start" }}>
          {league.season_title}
        </span>
        <h1>{league.name}</h1>
        <p>
          {league.member_count} {league.member_count === 1 ? "team has" : "teams have"} joined so far.
        </p>
      </section>
      {closed ? (
        <div className="note">
          <span>This league&apos;s draft has already started. Ask the commissioner to add you.</span>
        </div>
      ) : user ? (
        <JoinForm code={code} />
      ) : (
        <div className="panel">
          <h3>Sign in to join</h3>
          <span className="soft">Use your Google account. You&apos;ll name your team next.</span>
          <SignInButton next={`/join/${code}`} />
        </div>
      )}
    </main>
  );
}
