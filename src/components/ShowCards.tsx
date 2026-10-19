import Link from "next/link";
import { statusLine, type ShowInfo } from "@/lib/catalog";

/** One card per show. `playing` marks shows the person already has a league in. */
export default function ShowCards({ catalog, playing = new Set<string>() }: { catalog: ShowInfo[]; playing?: Set<string> }) {
  return (
    <div className="cards">
      {catalog.map(({ show, current }) => (
        <Link key={show.key} href={`/shows/${show.slug}`} className={`leaguecard showcard show-${show.key}`}>
          <span className="small soft">{[current?.network, statusLine(current)].filter(Boolean).join(" · ")}</span>
          <b>{current?.title ?? show.name}</b>
          <span className="small">{show.blurb}</span>
          <span className="small showcta">{playing.has(show.key) ? "You're playing · start another league" : "Start a league"} →</span>
        </Link>
      ))}
    </div>
  );
}
