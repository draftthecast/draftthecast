import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import SignInButton from "@/components/SignInButton";
import { CreateLeague, JoinWithCode } from "@/components/HomeForms";

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

  const [{ data: leagues }, { data: seasons }] = await Promise.all([
    supabase.from("leagues").select("id, name, season_id, draft_status, seasons(title)").order("created_at", { ascending: false }),
    supabase.from("seasons").select("id, title").eq("active", true).order("created_at"),
  ]);

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
      <div className="grid2">
        <CreateLeague seasons={seasons ?? []} />
        <JoinWithCode />
      </div>
    </main>
  );
}
