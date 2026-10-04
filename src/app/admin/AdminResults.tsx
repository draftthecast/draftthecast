"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FLAGS, chefStates } from "@/lib/scoring";
import type { Contestant, Episode, FlagKey, TeamResult } from "@/lib/types";

interface Draft {
  num: number;
  title: string;
  airLocal: string; // yyyy-mm-ddThh:mm in Eastern time
  posted: boolean;
  challenge_win: TeamResult;
  service_win: TeamResult;
  flags: Record<string, Partial<Record<FlagKey, boolean>>>;
  winner: string;
  bonus: Record<string, string>;
  notes: string;
}

// Convert between UTC timestamps and Eastern wall-clock time for the air-time field.
function toEastern(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
function fromEastern(local: string): string | null {
  if (!local) return null;
  const asUtc = new Date(`${local}:00Z`);
  // Find the Eastern offset at that moment, then shift.
  const eastern = new Date(asUtc.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() + (utc.getTime() - eastern.getTime())).toISOString();
}

function toDraft(ep: Episode): Draft {
  const flags: Draft["flags"] = {};
  for (const [k] of FLAGS) for (const id of ep[k] ?? []) (flags[id] ??= {})[k] = true;
  return {
    num: ep.num,
    title: ep.title ?? "",
    airLocal: toEastern(ep.air_at),
    posted: ep.posted,
    challenge_win: ep.challenge_win,
    service_win: ep.service_win,
    flags,
    winner: ep.winner ?? "",
    bonus: Object.fromEntries(Object.entries(ep.bonus ?? {}).map(([k, v]) => [k, String(v)])),
    notes: ep.notes ?? "",
  };
}

export default function AdminResults({ seasons }: { seasons: { id: string; title: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [season, setSeason] = useState(seasons[0]?.id ?? "");
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function save() {
    if (!edit) return;
    setBusy(true);
    setMsg("");
    const row: Partial<Episode> & { season_id: string; num: number; updated_at: string } = {
      season_id: season,
      num: edit.num,
      title: edit.title.trim() || null,
      air_at: fromEastern(edit.airLocal),
      posted: edit.posted,
      challenge_win: edit.challenge_win || null,
      service_win: edit.service_win || null,
      winner: edit.winner || null,
      notes: edit.notes.trim() || null,
      bonus: Object.fromEntries(Object.entries(edit.bonus).map(([k, v]) => [k, Number(v)]).filter(([, v]) => v)),
      updated_at: new Date().toISOString(),
    };
    for (const [k] of FLAGS) row[k] = contestants.filter((c) => edit.flags[c.id]?.[k]).map((c) => c.id);
    const { error } = await supabase.from("episodes").upsert(row, { onConflict: "season_id,num" });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(edit.posted ? `Episode ${edit.num} saved and posted. Every league's points are updated.` : `Episode ${edit.num} saved as a draft. It won't count until you post it.`);
    setEdit(null);
    load();
  }

  if (edit) {
    const st = chefStates(contestants, episodes, 1, edit.num);
    const sorted = [...contestants].sort(
      (a, b) => Number(st[a.id].out !== null) - Number(st[b.id].out !== null) || st[a.id].team.localeCompare(st[b.id].team) || a.name.localeCompare(b.name),
    );
    const teamSel = (id: string, value: TeamResult, set: (v: TeamResult) => void) => (
      <select id={id} value={value ?? ""} onChange={(e) => set((e.target.value || null) as TeamResult)}>
        <option value="">No team result</option>
        <option value="red">Red team</option>
        <option value="blue">Blue team</option>
        <option value="both">Both teams</option>
      </select>
    );
    return (
      <main className="section">
        <div className="sechead">
          <h1>Episode {edit.num}</h1>
          <button className="btn ghost" onClick={() => setEdit(null)}>Back</button>
        </div>
        <div className="panel">
          <div className="grid2">
            <label className="field">Title<input id="ep-title" type="text" maxLength={80} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="field">Airs (Eastern time)<input id="ep-air" type="datetime-local" value={edit.airLocal} onChange={(e) => setEdit({ ...edit, airLocal: e.target.value })} /></label>
            <label className="field">Challenge won by{teamSel("ep-challenge", edit.challenge_win, (v) => setEdit({ ...edit, challenge_win: v }))}</label>
            <label className="field">Dinner service won by{teamSel("ep-service", edit.service_win, (v) => setEdit({ ...edit, service_win: v }))}</label>
          </div>
          <p className="soft small">
            Weekly guesses lock at the air time, so update it if the network moves an episode. Tick what happened to each chef; points for staying in are
            automatic. Once chefs get black jackets and play solo, leave both team results empty and mark challenge winners as Standouts.
          </p>
        </div>
        <div className="edit-table">
          <table>
            <thead>
              <tr><th>Chef</th>{FLAGS.map(([k, l]) => <th key={k}>{l}</th>)}<th>Won it all</th><th>Bonus pts</th></tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const gone = st[c.id].out !== null;
                const f = edit.flags[c.id] ?? {};
                return (
                  <tr key={c.id} className={gone ? "gone" : ""}>
                    <td><span className={`chip ${gone ? "out" : st[c.id].team}`}>{c.name}</span></td>
                    {FLAGS.map(([k]) => (
                      <td key={k}>
                        <input type="checkbox" aria-label={`${c.name} ${k}`} disabled={gone} checked={!!f[k]}
                          onChange={(e) => setEdit({ ...edit, flags: { ...edit.flags, [c.id]: { ...f, [k]: e.target.checked } } })} />
                      </td>
                    ))}
                    <td><input type="radio" name="winner" aria-label={`${c.name} wins`} disabled={gone} checked={edit.winner === c.id} onChange={() => setEdit({ ...edit, winner: c.id })} /></td>
                    <td><input type="number" step={1} aria-label={`${c.name} bonus`} disabled={gone} value={edit.bonus[c.id] ?? ""} onChange={(e) => setEdit({ ...edit, bonus: { ...edit.bonus, [c.id]: e.target.value } })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <label className="field">Notes for every league (optional)<input id="ep-notes" type="text" maxLength={240} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
        <label className="row" style={{ gap: 8 }}>
          <input id="ep-posted" type="checkbox" checked={edit.posted} onChange={(e) => setEdit({ ...edit, posted: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span><b>Post these results.</b> <span className="soft">Leave unticked to save a draft that doesn&apos;t count yet.</span></span>
        </label>
        {msg && <span className="error">{msg}</span>}
        <div className="row">
          <button className="btn brand" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save episode"}</button>
          {edit.winner && <button className="btn ghost" onClick={() => setEdit({ ...edit, winner: "" })}>Clear winner</button>}
        </div>
      </main>
    );
  }

  const nextNum = (episodes.at(-1)?.num ?? 0) + 1;
  return (
    <main className="section">
      <div className="sechead">
        <h1>Enter results</h1>
        {seasons.length > 1 && (
          <select id="admin-season" value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season">
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </div>
      <p className="soft">Results you post here update every league for this season. Add each episode after it airs.</p>
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
              <button className="btn small" onClick={() => { setMsg(""); setEdit(toDraft(ep)); }}>{ep.posted ? "Edit" : "Enter results"}</button>
            </span>
          </div>
        ))}
      </div>
      <div>
        <button className="btn ghost" onClick={() => {
          setMsg("");
          setEdit({ num: nextNum, title: "", airLocal: "", posted: false, challenge_win: null, service_win: null, flags: {}, winner: "", bonus: {}, notes: "" });
        }}>Add episode {nextNum}</button>
      </div>
    </main>
  );
}
