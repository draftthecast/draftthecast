import { scoringGroups, type ShowDef } from "@/lib/shows";

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export default function ScoringTable({ show }: { show: ShowDef }) {
  return (
    <div className="ptsgrid">
      {scoringGroups(show).map((g) => (
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
