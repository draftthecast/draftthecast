"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ResultsEditor, { draftFromEpisode, draftToRow, emptyDraft, fromEastern, type ResultsDraft } from "@/components/ResultsEditor";
import type { Contestant, Episode } from "@/lib/types";

export default function AdminResults({ seasons }: { seasons: { id: string; title: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [season, setSeason] = useState(seasons[0]?.id ?? "");
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [edit, setEdit] = useState<ResultsDraft | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!season) return;
    const [c, e] = await Promise.all([
      supabase.from("contestants").select("*").eq("season_id", season).order("name"),
      supabase.from("episodes").select("*").eq("season_id", season).order("num"),
    ]);
    setContestants((c.data ?? []) as Contestant[]);
    setEpisodes((e.data ?? []) as Episode[]);
  }, [supabase, season]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(d: ResultsDraft): Promise<string | null> {
    const row = {
      ...draftToRow(d, contestants),
      season_id: season,
      num: d.num,
      title: d.title.trim() || null,
      air_at: fromEastern(d.airLocal),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("episodes").upsert(row, { onConflict: "season_id,num" });
    if (error) return error.message;
    setMsg(d.posted ? `Episode ${d.num} saved and posted for every league that hasn't entered its own.` : `Episode ${d.num} saved as a draft. It won't count until you post it.`);
    setEdit(null);
    load();
    return null;
  }

  if (edit) {
    return (
      <main className="section">
        <ResultsEditor
          initial={edit}
          contestants={contestants}
          episodes={episodes}
          heading={`Site-wide results: episode ${edit.num}`}
          intro="These apply to every league, except leagues whose commissioner entered their own results for this episode. Weekly guesses lock at the air time, so update it if the network moves an episode."
          showSchedule
          showPosted
          saveLabel="Save episode"
          onSave={save}
          onCancel={() => setEdit(null)}
        />
      </main>
    );
  }

  const nextNum = (episodes.at(-1)?.num ?? 0) + 1;
  return (
    <main className="section">
      <div className="sechead">
        <h1>Site-wide results</h1>
        {seasons.length > 1 && (
          <select id="admin-season" value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season">
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </div>
      <p className="soft">
        Results posted here count for every league. A league&apos;s commissioner can also enter results for their own league, which take priority over these.
        To fix one league, open it from the list below and use its Results tab.
      </p>
      {msg && <div className="note sun"><span>{msg}</span></div>}
      <div className="table list calls">
        {episodes.map((ep) => (
          <div key={ep.num} className="it">
            <span>
              <b>Episode {ep.num}</b>{ep.title ? `: ${ep.title}` : ""}{" "}
              <span className="soft small">
                {ep.air_at ? new Date(ep.air_at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No air time"}
              </span>
            </span>
            <span className="row">
              <span className={`chip ${ep.posted ? "win" : "plain"}`}>{ep.posted ? "Posted" : "Not posted"}</span>
              <button className="btn small" onClick={() => { setMsg(""); setEdit(draftFromEpisode(ep)); }}>{ep.posted ? "Edit" : "Enter results"}</button>
            </span>
          </div>
        ))}
      </div>
      <div>
        <button className="btn ghost" onClick={() => { setMsg(""); setEdit({ ...emptyDraft(nextNum), posted: false }); }}>Add episode {nextNum}</button>
      </div>
    </main>
  );
}
