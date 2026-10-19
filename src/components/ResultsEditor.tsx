"use client";

import { useState } from "react";
import { chefStates, eventIds } from "@/lib/scoring";
import { COLUMN_EVENTS, cap, type ShowDef } from "@/lib/shows";
import type { Contestant, Episode, FlagKey, TeamResult } from "@/lib/types";

export interface ResultsDraft {
  num: number;
  title: string;
  airLocal: string; // yyyy-mm-ddThh:mm, Eastern time
  posted: boolean;
  challenge_win: TeamResult;
  service_win: TeamResult;
  flags: Record<string, Record<string, boolean>>;
  winner: string;
  bonus: Record<string, string>;
  notes: string;
}

export type ResultsRow = Pick<Episode, "challenge_win" | "service_win" | "winner" | "notes" | "bonus" | FlagKey | "posted" | "events">;

const COLUMNS = new Set<string>(COLUMN_EVENTS);

// Convert between UTC timestamps and Eastern wall-clock time for the air-time field.
export function toEastern(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
export function fromEastern(local: string): string | null {
  if (!local) return null;
  const asUtc = new Date(`${local}:00Z`);
  const eastern = new Date(asUtc.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() + (utc.getTime() - eastern.getTime())).toISOString();
}

export function draftFromEpisode(show: ShowDef, ep: Episode): ResultsDraft {
  const flags: ResultsDraft["flags"] = {};
  for (const e of show.events) for (const id of eventIds(ep, e.key)) (flags[id] ??= {})[e.key] = true;
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

export function emptyDraft(num: number, ep?: Episode | null): ResultsDraft {
  return {
    num, title: ep?.title ?? "", airLocal: toEastern(ep?.air_at ?? null), posted: true, challenge_win: null, service_win: null,
    flags: {}, winner: "", bonus: {}, notes: "",
  };
}

export function draftToRow(show: ShowDef, d: ResultsDraft, contestants: Contestant[]): ResultsRow {
  const row = {
    posted: d.posted,
    challenge_win: d.challenge_win || null,
    service_win: d.service_win || null,
    winner: d.winner || null,
    notes: d.notes.trim() || null,
    bonus: Object.fromEntries(Object.entries(d.bonus).map(([k, v]) => [k, Number(v)]).filter(([, v]) => v)),
  } as ResultsRow;
  const ids = (k: string) => contestants.filter((c) => d.flags[c.id]?.[k]).map((c) => c.id);
  for (const k of COLUMN_EVENTS) row[k] = show.events.some((e) => e.key === k) ? ids(k) : [];
  const extra = show.events.filter((e) => !COLUMNS.has(e.key));
  // Only shows with their own events write the column, so Hell's Kitchen saves work before the events column exists.
  if (extra.length) row.events = Object.fromEntries(extra.map((e) => [e.key, ids(e.key)]).filter(([, v]) => v.length));
  if (show.multiWinner) row.winner = null;
  return row;
}

export default function ResultsEditor({
  show, initial, contestants, episodes, heading, intro, showSchedule = false, showPosted = false, saveLabel = "Save results", onSave, onCancel,
}: {
  show: ShowDef;
  initial: ResultsDraft;
  contestants: Contestant[];
  episodes: Episode[];
  heading: string;
  intro?: React.ReactNode;
  showSchedule?: boolean;
  showPosted?: boolean;
  saveLabel?: string;
  onSave: (d: ResultsDraft) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [edit, setEdit] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const st = chefStates(show, contestants, episodes, 1, edit.num);
  const sorted = [...contestants].sort(
    (a, b) => Number(st[a.id].out !== null) - Number(st[b.id].out !== null) || (st[a.id].team ?? "").localeCompare(st[b.id].team ?? "") || a.name.localeCompare(b.name),
  );
  const teamSel = (id: string, value: TeamResult, set: (v: TeamResult) => void) => (
    <select id={id} value={value ?? ""} onChange={(e) => set((e.target.value || null) as TeamResult)}>
      <option value="">No team result</option>
      <option value="red">Red team</option>
      <option value="blue">Blue team</option>
      <option value="both">Both teams</option>
    </select>
  );

  async function save() {
    setBusy(true);
    setError("");
    const err = await onSave(edit);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <section className="section">
      <div className="sechead">
        <h2>{heading}</h2>
        <button className="btn ghost" onClick={onCancel}>Back</button>
      </div>
      <div className="panel">
        <div className="grid2">
          {showSchedule && (
            <>
              <label className="field">Title<input id="ep-title" type="text" maxLength={80} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
              <label className="field">Airs (Eastern time)<input id="ep-air" type="datetime-local" value={edit.airLocal} onChange={(e) => setEdit({ ...edit, airLocal: e.target.value })} /></label>
            </>
          )}
          {show.teamResults.map((t) => (
            <label key={t.key} className="field">{t.label}{teamSel(`ep-${t.key}`, edit[t.key], (v) => setEdit({ ...edit, [t.key]: v }))}</label>
          ))}
        </div>
        {intro && <p className="soft small">{intro}</p>}
        <p className="soft small">
          Tick what happened to each {show.noun.one}; points for staying in are added automatically.
          {show.teams
            ? " Once chefs get black jackets and play solo, leave both team results empty."
            : " Count a murder in the episode where the victim is revealed."}
        </p>
      </div>
      <div className="edit-table">
        <table>
          <thead>
            <tr><th>{cap(show.noun.one)}</th>{show.events.map((e) => <th key={e.key}>{e.label}</th>)}{!show.multiWinner && <th>Won it all</th>}<th>Bonus pts</th></tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const gone = st[c.id].out !== null;
              const f = edit.flags[c.id] ?? {};
              return (
                <tr key={c.id} className={gone ? "gone" : ""}>
                  <td><span className={`chip ${gone ? "out" : st[c.id].traitor ? "traitor" : st[c.id].team ?? "plain"}`}>{c.name}</span></td>
                  {show.events.map(({ key: k, label }) => (
                    <td key={k}>
                      <input type="checkbox" aria-label={`${c.name} ${label}`} disabled={gone} checked={!!f[k]}
                        onChange={(e) => setEdit({ ...edit, flags: { ...edit.flags, [c.id]: { ...f, [k]: e.target.checked } } })} />
                    </td>
                  ))}
                  {!show.multiWinner && (
                    <td><input type="radio" name="winner" aria-label={`${c.name} wins`} disabled={gone} checked={edit.winner === c.id} onChange={() => setEdit({ ...edit, winner: c.id })} /></td>
                  )}
                  <td><input type="number" step={1} aria-label={`${c.name} bonus`} disabled={gone} value={edit.bonus[c.id] ?? ""} onChange={(e) => setEdit({ ...edit, bonus: { ...edit.bonus, [c.id]: e.target.value } })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="field">Notes (optional)<input id="ep-notes" type="text" maxLength={240} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
      {showPosted && (
        <label className="row" style={{ gap: 8 }}>
          <input id="ep-posted" type="checkbox" checked={edit.posted} onChange={(e) => setEdit({ ...edit, posted: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span><b>Post these results.</b> <span className="soft">Leave unticked to save a draft that doesn&apos;t count yet.</span></span>
        </label>
      )}
      {error && <span className="error">{error}</span>}
      <div className="row">
        <button className="btn brand" disabled={busy} onClick={save}>{busy ? "Saving…" : saveLabel}</button>
        {edit.winner && !show.multiWinner && <button className="btn ghost" onClick={() => setEdit({ ...edit, winner: "" })}>Clear winner</button>}
      </div>
    </section>
  );
}
