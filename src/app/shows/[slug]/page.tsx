import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getCatalog, statusLine } from "@/lib/catalog";
import { showBySlug } from "@/lib/shows";
import ScoringTable from "@/components/ScoringTable";
import SignInButton from "@/components/SignInButton";
import ShowCards from "@/components/ShowCards";
import { CreateLeague } from "@/components/HomeForms";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const show = showBySlug((await params).slug);
  if (!show) return {};
  return {
    title: `${show.name} fantasy league`,
    description: `Free ${show.name} fantasy league on Draft the Cast. ${show.blurb}`,
    alternates: { canonical: `/shows/${show.slug}` },
  };
}

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const show = showBySlug((await params).slug);
  if (!show) notFound();
  const { supabase, user } = await getUser();
  const catalog = await getCatalog(supabase);
  const info = catalog.find((c) => c.show.key === show.key);
  const current = info?.current ?? null;
  const others = catalog.filter((c) => c.show.key !== show.key);

  return (
    <main className="section" style={{ gap: 24 }}>
      <section className="hero">
        <span className="showtag" style={{ alignSelf: "flex-start" }}>
          {[current?.network, statusLine(current) || "Not on the schedule yet"].filter(Boolean).join(" · ")}
        </span>
        <h1>{current?.title ?? show.name}</h1>
        <p>{show.blurb}</p>
      </section>
      <ol className="steps">
        <li><h3>Start or join a league</h3><span className="soft">Create one and send the invite link, or open a link a friend sent you.</span></li>
        {show.steps.map(([h, t]) => <li key={h}><h3>{h}</h3><span className="soft">{t}</span></li>)}
      </ol>
      {current ? (
        user ? (
          <div className="grid2">
            <CreateLeague seasons={info!.seasons.filter((s) => s.status !== "finished").map((s) => ({ ...s, show_key: show.key }))} initial={current.id} />
            <div className="panel">
              <h3>Joining late?</h3>
              <span className="soft small">
                You can start a league mid-season. Points count from the next episode, and the draft only shows {show.noun.many} who are still in.
              </span>
              <Link className="btn ghost small" href="/">Back to your leagues</Link>
            </div>
          </div>
        ) : (
          <div className="panel">
            <h3>Sign in to start a {show.name} league</h3>
            <span className="soft">Use your Google account. It&apos;s free.</span>
            <SignInButton next={`/shows/${show.slug}#start`} />
          </div>
        )
      ) : (
        <div className="empty"><b>No season to play right now</b><span>Check back when the next season is announced.</span></div>
      )}
      <section className="section">
        <h2>Points</h2>
        <ScoringTable show={show} />
        <p className="soft small">{show.scoringNote} Ties go to whoever has more correct weekly guesses.</p>
      </section>
      {others.length > 0 && (
        <section className="section">
          <h2>Other shows</h2>
          <ShowCards catalog={others} />
        </section>
      )}
    </main>
  );
}
