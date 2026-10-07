import type { Metadata } from "next";
import Link from "next/link";
import ScoringTable from "@/components/ScoringTable";
import { PTS } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "How to play Hell's Kitchen fantasy",
  description:
    "How Draft the Cast fantasy leagues work for Hell's Kitchen Season 25: draft chefs with friends, score points for challenge wins, surviving elimination and black jackets, and guess who goes home each week.",
  alternates: { canonical: "/how-to-play" },
};

const FAQ: [string, string][] = [
  ["Is it free?", "Yes. Draft the Cast is free to play, with no entry fees or prizes run through the site."],
  ["How do I join a league?", "Open the invite link a friend sends you, sign in with Google, and name your team. Or start your own league and share its link."],
  ["How does the draft work?", "In a take-turns draft, teams pick one chef at a time and the order reverses each round, so each chef ends up on one team. In a free-pick league, everyone picks their chefs and the same chef can be on several teams."],
  ["When do points update?", "After each episode airs, the episode's results are added and every team's points update right away."],
  ["What happens when my chef goes home?", "They stop earning points, but you keep everything they scored before they left."],
  ["How do weekly guesses work?", `Before each episode, guess who Chef Ramsay sends home. A correct guess is worth ${PTS.guess} points. Guesses lock when the episode starts.`],
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
        <p>Draft the Cast is a free fantasy game for reality TV. Right now you can play along with Hell&apos;s Kitchen Season 25 on FOX.</p>
      </section>
      <ol className="steps">
        <li><h3>Join a league</h3><span className="soft">Start one and share the invite link, or open a link a friend sent you.</span></li>
        <li><h3>Draft your chefs</h3><span className="soft">Take turns picking contestants until every team is full.</span></li>
        <li><h3>Score every episode</h3><span className="soft">Your chefs earn points for wins, surviving elimination and black jackets. Most points at the finale wins.</span></li>
      </ol>
      <section className="section">
        <h2>Points</h2>
        <ScoringTable />
        <p className="soft small">
          Being up for elimination costs {Math.abs(PTS.nominated)} points, but surviving it pays {PTS.survivedBlock}, so a chef who keeps escaping still helps you.
          Ties go to whoever has more correct weekly guesses.
        </p>
      </section>
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
