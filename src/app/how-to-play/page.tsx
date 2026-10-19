import type { Metadata } from "next";
import Link from "next/link";
import ScoringTable from "@/components/ScoringTable";
import { SHOWS } from "@/lib/shows";

export const metadata: Metadata = {
  title: "How to play reality TV fantasy",
  description:
    "How Draft the Cast fantasy leagues work for Hell's Kitchen and The Traitors: draft contestants with friends, score points every episode, and guess who's out each week.",
  alternates: { canonical: "/how-to-play" },
};

const FAQ: [string, string][] = [
  ["Is it free?", "Yes. Draft the Cast is free to play, with no entry fees or prizes run through the site."],
  ["Which shows can I play?", `Right now: ${SHOWS.map((s) => s.name).join(" and ")}. Each league belongs to one show and season, with that show's own scoring.`],
  ["How do I join a league?", "Open the invite link a friend sends you, sign in with Google, and name your team. Or start your own league and share its link."],
  ["How does the draft work?", "In a take-turns draft, teams pick one contestant at a time and the order reverses each round, so each contestant ends up on one team. In a free-pick league, everyone picks their own and the same contestant can be on several teams."],
  ["When do points update?", "After each episode airs, the episode's results are added and every team's points update right away."],
  ["What happens when my pick is out?", "They stop earning points, but you keep everything they scored before they left."],
  ["How do weekly guesses work?", "Before each episode, guess who's out: sent home in Hell's Kitchen, murdered or banished in The Traitors. Guesses lock when the episode starts."],
  ["Can I start a league mid-season?", "Yes. Points count from the next episode, and the draft only shows contestants who are still in."],
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default function HowToPlay() {
  return (
    <main className="section" style={{ gap: 24 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <section className="hero">
        <h1>How to play</h1>
        <p>Draft the Cast is a free fantasy game for reality TV. Pick a show, start a league with friends, and score points from every episode.</p>
      </section>
      <ol className="steps">
        <li><h3>Join a league</h3><span className="soft">Start one for any show and share the invite link, or open a link a friend sent you.</span></li>
        <li><h3>Draft your picks</h3><span className="soft">Take turns picking contestants until every team is full.</span></li>
        <li><h3>Score every episode</h3><span className="soft">Your picks earn points for what happens on the show. Most points at the finale wins.</span></li>
      </ol>
      {SHOWS.map((show) => (
        <section key={show.key} className="section">
          <div className="sechead">
            <h2>{show.name} points</h2>
            <Link className="btn ghost small" href={`/shows/${show.slug}`}>Start a {show.name} league</Link>
          </div>
          <ScoringTable show={show} />
          <p className="soft small">{show.scoringNote} Ties go to whoever has more correct weekly guesses.</p>
        </section>
      ))}
      <section className="section prose-page">
        <h2>Questions</h2>
        {FAQ.map(([q, a]) => (
          <div key={q}><h3>{q}</h3><p className="soft">{a}</p></div>
        ))}
      </section>
      <div><Link className="btn brand" href="/">Start or join a league</Link></div>
    </main>
  );
}
