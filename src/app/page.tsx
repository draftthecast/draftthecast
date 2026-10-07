import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { adminViewOn, isAdmin } from "@/lib/viewMode";
import SignInButton from "@/components/SignInButton";
import { CreateLeague, JoinWithCode } from "@/components/HomeForms";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home({ searchParams }: { searchParams: Promise<{ signin?: string; reason?: string }> }) {
  const { signin, reason } = await searchParams;
  const { supabase, user } = await getUser();

  if (!user) {
    return (
      <main className="section" style={{ gap: 28 }}>
        <section className="hero">
          <h1>Fantasy leagues for reality TV</h1>
          <p>
            Draft chefs from Hell&apos;s Kitchen Season 25, guess who goes home each week, and see who on your group chat
            really knows the show.
          </p>
          <SignInButton />
          {signin === "failed" && (
            <span className="error">
              Sign-in didn&apos;t finish{reason ? ` (${reason})` : ""}. Try again, and if it keeps happening, open the site in Safari or Chrome instead of
              an app&apos;s built-in browser.
            </span>
          )}
        </section>
        <ol className="steps">
          <li>
            <h3>Start or join a league</h3>
            <span className="soft">Create one and send the invite link, or open a link a friend sent you.</span>
          </li>
          <li>
            <h3>Draft your chefs</h3>
            <span className="soft">Take turns picking contestants until every team is full.</span>
          </li>
          <li>
            <h3>Score every episode</h3>
            <span className="soft">Wins, survivals and black jackets earn points. Most points at the finale wins.</span>
          </li>
        </ol>
      </main>
    );
  }

  const adminView = await adminViewOn(await isAdmin(supabase, user.id));
  const [{ data: leagues }, { data: seasons }, { data: allLeagues }] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, season_id, draft_status, seasons(title), league_members!inner(user_id)")
      .eq("league_members.user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("seasons").select("id, title").eq("active", true).order("created_at"),
    adminView
      ? supabase.from("leagues").select("id, name, draft_status, seasons(title), league_members(count)").order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);
  const mineIds = new Set((leagues ?? []).map((l) => l.id));
  const others = (allLeagues ?? []).filter((l) => !mineIds.has(l.id));

  return (
    <main className="section" style={{ gap: 28 }}>
      <section className="section">
        <h1>Your leagues</h1>
        {leagues && leagues.length ? (
          <div className="cards">
            {leagues.map((l) => {
              const season = (l.seasons as unknown as { title: string } | null)?.title ?? "";
              return (
                <Link key={l.id} href={`/league/${l.id}`} className="leaguecard">
                  <b>{l.name}</b>
                  <span className="soft small">{season}</span>
                  <span className="small">
                    {l.draft_status === "setup" ? "Draft not open yet" : l.draft_status === "open" ? "Draft in progress" : "Season underway"}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <b>You&apos;re not in a league yet</b>
            <span>Start one below, or open the invite link a friend sent you.</span>
          </div>
        )}
      </section>
      {adminView && others.length > 0 && (
        <section className="section">
          <div className="sechead">
            <h2>Other leagues</h2>
            <span className="soft small">Only you see these, because you&apos;re the site admin</span>
          </div>
          <div className="cards">
            {others.map((l) => (
              <Link key={l.id} href={`/league/${l.id}`} className="leaguecard">
                <b>{l.name}</b>
                <span className="soft small">{(l.seasons as unknown as { title: string } | null)?.title ?? ""}</span>
                <span className="small">{(l.league_members as unknown as { count: number }[])?.[0]?.count ?? 0} teams</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="grid2">
        <CreateLeague seasons={seasons ?? []} />
        <JoinWithCode />
      </div>
    </main>
  );
}
