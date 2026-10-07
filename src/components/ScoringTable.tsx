import { PTS } from "@/lib/scoring";

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export const SCORING_GROUPS: { title: string; rows: [string, number][] }[] = [
  { title: "Each episode", rows: [
    ["Stays in the competition", PTS.survive],
    ["Their team wins the challenge", PTS.challenge],
    ["Their team wins dinner service", PTS.service],
    ["Standout of the night (best dish, challenge win, punishment pass)", PTS.mvp],
  ] },
  { title: "Elimination", rows: [
    ["Put up for elimination", PTS.nominated],
    ["Survives elimination", PTS.survivedBlock],
    ["Kicked out of dinner service", PTS.ejected],
    ["Sent home", PTS.eliminated],
    ["Quits or leaves for medical reasons", PTS.quit],
    ["Switches teams", PTS.switched],
  ] },
  { title: "End of the season", rows: [
    ["Earns a black jacket", PTS.blackJacket],
    ["Makes the final 2", PTS.final2],
    ["Wins the season", PTS.winner],
  ] },
  { title: "Your guesses", rows: [
    ["Correctly guess who goes home", PTS.guess],
    ["Correctly guess the season winner", PTS.winnerPick],
  ] },
];

export default function ScoringTable() {
  return (
    <div className="ptsgrid">
      {SCORING_GROUPS.map((g) => (
        <div key={g.title} className="ptlist">
          <h3>{g.title}</h3>
          {g.rows.map(([t, p]) => (
            <div key={t} className="l"><span>{t}</span><b className={p > 0 ? "up" : "down"}>{sign(p)}</b></div>
          ))}
        </div>
      ))}
    </div>
  );
}
