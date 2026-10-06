"use client";

import { useState } from "react";
import { FLAGS, chefStates } from "@/lib/scoring";
import type { Contestant, Episode, FlagKey, TeamResult } from "@/lib/types";

export interface ResultsDraft {
  num: number;
  title: string;
  airLocal: string; // yyyy-mm-ddThh:mm, Eastern time
  posted: boolean;
  challenge_win: TeamResult;
  service_win: TeamResult;
  flags: Record<string, Partial<Record<FlagKey, boolean>>>;
  winner: string;
  bonus: Record<string, string>;
  notes: string;
}

export type ResultsRow = Pick<Episode, "challenge_win" | "service_win" | "winner" | "notes" | "bonus" | FlagKey | "posted">;

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

export function draftFromEpisode(ep: Episode): ResultsDraft {
  const flags: ResultsDraft["flags"] = {};
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

export function emptyDraft(num: number, ep?: Episode | null): ResultsDraft {
  return {
    num, title: ep?.title ?? "", airLocal: toEastern(ep?.air_at ?? null), posted: true, challenge_win: null, service_win: null,
    flags: {}, winner: "", bonus: {}, notes: "",
  };
}

export function draftToRow(d: ResultsDraft, contestants: Contestant[]): ResultsRow {
  const row = {
    posted: d.posted,
    challenge_win: d.challenge_win || null,
    service_win: d.service_win || null,
    winner: d.winner || null,
    notes: d.notes.trim() || null,
    bonus: Object.fromEntries(Object.entries(d.bonus).map(([k, v]) => [k, Number(v)]).filter(([, v]) => v)),
  } as ResultsRow;
  for (const [k] of FLAGS) row[k] = contestants.filter((c) => d.flags[c.id]?.[k]).map((c) => c.id);
  return row;
}

export default function ResultsEditor({
  initial, contestants, episodes, heading, intro, showSchedule = false, showPosted = false, saveLabel = "Save results", onSave, onCancel,
}: {
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
          <label className="field">Challenge won by{teamSel("ep-challenge", edit.challenge_win, (v) => setEdit({ ...edit, challenge_win: v }))}</label>
          <label className="field">Dinner service won by{teamSel("ep-service", edit.service_win, (v) => setEdit({ ...edit, service_win: v }))}</label>
        </div>
        {intro && <p className="soft small">{intro}</p>}
        <p className="soft small">
          Tick what happened to each chef; points for staying in are added automatically. Once chefs get black jackets and play solo, leave both team
          results empty and mark challenge winners as Standouts.
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
        {edit.winner && <button className="btn ghost" onClick={() => setEdit({ ...edit, winner: "" })}>Clear winner</button>}
      </div>
    </section>
  );
}
