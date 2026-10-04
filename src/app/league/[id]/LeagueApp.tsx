"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PTS, chefStates, draftInfo, isLocked, nextEpisode, standings, type ChefState, type DraftInfo } from "@/lib/scoring";
import type { Contestant, Episode, Guess, League, Member, Pick, Profile, Season } from "@/lib/types";

type Tab = "standings" | "draft" | "guess" | "chefs" | "results" | "rules" | "commish";
const TABS: [Tab, string][] = [
  ["standings", "Standings"],
  ["draft", "Draft"],
  ["guess", "Weekly guess"],
  ["chefs", "Chefs"],
  ["results", "Results"],
  ["rules", "How to play"],
  ["commish", "Commissioner"],
];

interface Data {
  league: League;
  season: Season | null;
  members: Member[];
  picks: Pick[];
  guesses: Guess[];
  contestants: Contestant[];
  episodes: Episode[];
  profiles: Record<string, Profile>;
}

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }) : "";
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).replace(":00", "") : "";

export default function LeagueApp({ leagueId, userId, isSiteAdmin }: { leagueId: string; userId: string; isSiteAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("standings");
  const [actAs, setActAs] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState<{ text: string; yes: string; run: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data: league, error } = await supabase.from("leagues").select("*").eq("id", leagueId).maybeSingle();
    if (error || !league) {
      setLoadError("This league couldn't be loaded. Refresh to try again.");
      return;
    }
    const [season, members, picks, guesses, contestants, episodes] = await Promise.all([
      supabase.from("seasons").select("*").eq("id", league.season_id).maybeSingle(),
      supabase.from("league_members").select("*").eq("league_id", leagueId).order("joined_at"),
      supabase.from("picks").select("*").eq("league_id", leagueId).order("pick_no"),
      supabase.from("guesses").select("*").eq("league_id", leagueId),
      supabase.from("contestants").select("*").eq("season_id", league.season_id).order("name"),
      supabase.from("episodes").select("*").eq("season_id", league.season_id).order("num"),
    ]);
    const userIds = (members.data ?? []).map((m) => m.user_id).filter(Boolean) as string[];
    const profiles: Record<string, Profile> = {};
    if (userIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
      for (const p of ps ?? []) profiles[p.id] = p;
    }
    setLoadError("");
    setData({
      league: league as League,
      season: (season.data as Season) ?? null,
      members: (members.data ?? []) as Member[],
      picks: (picks.data ?? []) as Pick[],
      guesses: (guesses.data ?? []) as Guess[],
      contestants: (contestants.data ?? []) as Contestant[],
      episodes: (episodes.data ?? []) as Episode[],
      profiles,
    });
  }, [supabase, leagueId]);

  // Initial load, live updates, and a refresh whenever the tab regains focus.
  useEffect(() => {
    load();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    const channel = supabase
      .channel(`league-${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "picks", filter: `league_id=eq.${leagueId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "guesses", filter: `league_id=eq.${leagueId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "leagues", filter: `id=eq.${leagueId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "episodes" }, soon)
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && soon();
    document.addEventListener("visibilitychange", onFocus);
    const poll = setInterval(soon, 60_000);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [supabase, leagueId, load]);

  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) flash(error.message.replace(/^.*?ERROR:\s*/, ""));
    else {
      if (ok) flash(ok);
      load();
    }
    return !error;
  }

  if (loadError) return <div className="empty"><b>Something went wrong</b><span>{loadError}</span></div>;
  if (!data) return <div className="empty"><span>Loading your league…</span></div>;

  const { league, members, picks, guesses, contestants, episodes, profiles } = data;
  const CHEF = Object.fromEntries(contestants.map((c) => [c.id, c]));
  const st = chefStates(contestants, episodes, league.start_episode);
  const me = members.find((m) => m.user_id === userId) ?? null;
  const isCommish = isSiteAdmin || me?.role === "commissioner";
  const acting: Member | null = (isCommish && actAs ? members.find((m) => m.id === actAs) : undefined) ?? me;
  const d = draftInfo(league, members, picks);
  const nextEp = nextEpisode(episodes);
  const locked = isLocked(nextEp);
  const posted = episodes.filter((e) => e.posted);
  const lastNum = posted.length ? posted[posted.length - 1].num : 0;
  const teamName = (id: string | null) => members.find((m) => m.id === id)?.team_name ?? "Unknown team";
  const managerName = (m: Member) =>
    m.user_id ? profiles[m.user_id]?.display_name ?? "League member" : m.manager_name || "Added by commissioner";
  const first = (cid: string) => (CHEF[cid]?.name ?? "").split(" ")[0];
  const active = contestants.filter((c) => st[c.id]?.out === null);
  const tabs = TABS.filter(([k]) => k !== "commish" || isCommish);

  const chip = (cid: string, withPts = false) => {
    const c = CHEF[cid];
    const s: ChefState | undefined = st[cid];
    if (!c || !s) return null;
    const cls = s.winner ? "win" : s.out !== null ? "out" : s.jacket ? "jacket" : s.team;
    return (
      <span key={cid} className={`chip ${cls}`} title={`${c.name}${s.out !== null ? `, sent home in episode ${s.out}` : ""}`}>
        {first(cid)}
        {withPts && <span className="p num">{s.pts} pts</span>}
      </span>
    );
  };

  const pickFor = isCommish && members.length > 0 && (
    <label className="field" style={{ maxWidth: 300 }}>
      Picking for
      <select id="act-as" value={acting?.id ?? ""} onChange={(e) => setActAs(e.target.value)}>
        {!acting && <option value="">Choose a team</option>}
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.team_name}
            {m.id === me?.id ? " (you)" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const x: Ctx = {
    league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d,
    nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab,
  };
  const View = VIEWS[tabs.some(([k]) => k === tab) ? tab : "standings"];

  return (
    <>
      <div className="title">
        <span className="showtag" style={{ alignSelf: "flex-start" }}>{data.season?.title}</span>
        <h1>{league.name}</h1>
      </div>
      <section className="week">
        <div>
          <div className="when">
            {nextEp ? (nextEp.air_at ? `Episode ${nextEp.num} airs ${fmtDate(nextEp.air_at)} at ${fmtTime(nextEp.air_at)}` : `Episode ${nextEp.num} is next`) : "Season complete"}
          </div>
          <div className="facts">
            <span>{active.length} of {contestants.length} chefs still in</span>
            <span>Points count from episode {league.start_episode}</span>
            {data.season?.network && <span>On {data.season.network}</span>}
          </div>
        </div>
        <div className="next"><NextStep x={x} /></div>
      </section>
      <nav className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); history.replaceState(null, "", `#${k}`); }}>{label}</button>
        ))}
      </nav>
      <main><View key={`${tab}-${acting?.id ?? ""}`} x={x} /></main>
      {confirm && (
        <div className="confirm" role="alertdialog">
          <span>{confirm.text}</span>
          <button className="btn sun small" onClick={() => { const r = confirm.run; setConfirm(null); r(); }}>{confirm.yes}</button>
          <button className="btn ghost small" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

interface Ctx {
  league: League; members: Member[]; picks: Pick[]; guesses: Guess[]; contestants: Contestant[]; episodes: Episode[];
  profiles: Record<string, Profile>; CHEF: Record<string, Contestant>; st: Record<string, ChefState>;
  me: Member | null; isCommish: boolean; isSiteAdmin: boolean; acting: Member | null; d: DraftInfo;
  nextEp: Episode | null; locked: boolean; posted: Episode[]; lastNum: number;
  teamName: (id: string | null) => string; managerName: (m: Member) => string; first: (cid: string) => string;
  active: Contestant[]; chip: (cid: string, withPts?: boolean) => React.ReactNode; pickFor: React.ReactNode;
  run: (fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>;
  busy: boolean; supabase: ReturnType<typeof createClient>; flash: (m: string) => void;
  setConfirm: (c: { text: string; yes: string; run: () => void } | null) => void; setTab: (t: Tab) => void;
}

/* ---------- this week ---------- */
function NextStep({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  if (!me && !isCommish) return <><b>You&apos;re viewing this league</b><span className="small soft">Open the invite link to join.</span></>;
  if (league.draft_status === "open" && league.mode === "snake" && d.turn && d.turn === me?.id)
    return <><b>You&apos;re up in the draft</b><span className="small soft">Pick {d.pickCount + 1} of {d.total}.</span><button className="btn sun" onClick={() => setTab("draft")}>Make your pick</button></>;
  const myCount = picks.filter((p) => p.member_id === me?.id).length;
  if (league.draft_status === "open" && league.mode === "open" && me && myCount < league.roster_size)
    return <><b>Pick your chefs</b><span className="small soft">{myCount} of {league.roster_size} chosen.</span><button className="btn sun" onClick={() => setTab("draft")}>Go to the draft</button></>;
  if (league.draft_status === "setup")
    return <><b>Draft opens soon</b><span className="small soft">{isCommish ? "Share the invite link, then open the draft from the Commissioner tab." : "The commissioner will open it once everyone has joined."}</span>{isCommish && <button className="btn ghost small" onClick={() => setTab("commish")}>Get the invite link</button>}</>;
  if (league.draft_status === "open" && league.mode === "snake" && d.turn)
    return <><b>Draft in progress</b><span className="small soft">{teamName(d.turn)} is picking.</span><button className="btn ghost small" onClick={() => setTab("draft")}>Watch the draft</button></>;
  if (!nextEp) return <><b>The season is over</b><span className="small soft">Check the final standings below.</span></>;
  const mine = me && guesses.find((g) => g.member_id === me.id && g.episode_num === nextEp.num);
  if (!locked && me && !mine)
    return <><b>Who goes home in episode {nextEp.num}?</b><span className="small soft">A correct guess is worth {PTS.guess} points.</span><button className="btn sun" onClick={() => setTab("guess")}>Make your guess</button></>;
  if (mine) return <><b>You&apos;re set for episode {nextEp.num}</b><span className="small soft">Your guess: {CHEF[mine.contestant_id]?.name}.</span></>;
  return <><b>Guesses are locked</b><span className="small soft">Results go up after the episode airs.</span></>;
}

/* ---------- standings ---------- */
function Standings({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const rows = standings(league, members, picks, guesses, episodes, st);
  const scored = lastNum >= league.start_episode;
  const [rename, setRename] = useState(me?.team_name ?? "");
  return (
    <section className="section">
      <div className="sechead">
        <h2>Standings</h2>
        <span className="soft small">{scored ? `After episode ${lastNum}` : `Scoring starts with episode ${league.start_episode}`}</span>
      </div>
      <div className="table">
        {rows.map((r, i) => (
          <div key={r.member.id} className={`stand ${i === 0 && r.total > 0 ? "lead" : ""}`}>
            <div className="rank num">{i + 1}</div>
            <div className="team">
              <div>
                <div className="tname">{r.member.team_name}</div>
                <div className="soft small">
                  {managerName(r.member)}
                  {r.member.winner_pick ? `, picked ${first(r.member.winner_pick)} to win` : ""}
                </div>
              </div>
              <div className="chips">
                {r.roster.length ? r.roster.map((cid) => chip(cid, true)) : <span className="soft small">No chefs yet</span>}
                {r.guessPts > 0 && <span className="chip plain">Guesses {r.guessPts} pts</span>}
                {r.winnerPts > 0 && <span className="chip win">Called the winner {r.winnerPts} pts</span>}
              </div>
            </div>
            <div className="score">
              <div className="tot num">{r.total}<small>pts</small></div>
              {scored && <span className={`delta ${r.lastPts > 0 ? "up" : r.lastPts < 0 ? "down" : ""}`}>{sign(r.lastPts)} this week</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="soft small">Crossed-out chefs have been sent home. Their points stay on your total. Ties go to whoever has more correct weekly guesses.</p>
      {me && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (rename.trim() && rename.trim() !== me.team_name)
              run(() => supabase.from("league_members").update({ team_name: rename.trim() }).eq("id", me.id), "Team renamed.");
          }}
        >
          <label className="field" style={{ flex: "1 1 220px" }}>
            Your team name
            <input id="rename-team" type="text" maxLength={40} value={rename} onChange={(e) => setRename(e.target.value)} />
          </label>
          <button className="btn ghost small" style={{ alignSelf: "flex-end" }} disabled={busy}>Rename</button>
        </form>
      )}
    </section>
  );
}

/* ---------- draft ---------- */
function Draft({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const myRoster = picks.filter((p) => p.member_id === acting?.id).map((p) => p.contestant_id);
  const open = league.draft_status === "open" && !d.done;
  const canPick = (cid: string) => {
    if (!open || !acting || st[cid]?.out !== null || myRoster.includes(cid)) return false;
    if (league.mode === "snake") return d.turn === acting.id && !d.taken.has(cid);
    return myRoster.length < league.roster_size;
  };
  const owners: Record<string, string[]> = {};
  for (const p of picks) (owners[p.contestant_id] ??= []).push(p.member_id);
  const sorted = [...contestants].sort(
    (a, b) => Number(st[a.id].out !== null) - Number(st[b.id].out !== null) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name),
  );
  let head;
  if (league.draft_status === "setup")
    head = <div className="note"><span><b>The draft isn&apos;t open yet.</b> {isCommish ? "Set the order and open it from the Commissioner tab." : "The commissioner opens it once everyone has joined."}</span></div>;
  else if (league.draft_status === "closed" || d.done)
    head = <div className="note"><span><b>The draft is done.</b> Teams are set. Points count from episode {league.start_episode}.</span></div>;
  else if (league.mode === "snake")
    head = <div className="note sun"><span>Pick {d.pickCount + 1} of {d.total}: <b>{teamName(d.turn)}</b>{d.turn === me?.id ? " (that's you)" : ""} is choosing.</span></div>;
  else
    head = <div className="note sun"><span>Choose {league.roster_size} chefs. Other teams can pick the same chefs.</span>{acting && <b className="num">{myRoster.length} of {league.roster_size} chosen</b>}</div>;
  return (
    <section className="section">
      <h2>Draft</h2>
      {head}
      {pickFor}
      {league.mode === "snake" && d.order.length > 0 && (
        <div className="section">
          <h3>Draft order</h3>
          <p className="soft small">The order flips each round, so whoever picks last in round 1 picks first in round 2.</p>
          <div className="order">
            {d.order.map((id, i) => (
              <span key={id} className={`chip plain ${id === d.turn ? "turn" : ""}`}>{i + 1}. {teamName(id)}</span>
            ))}
          </div>
        </div>
      )}
      {isCommish && league.mode === "snake" && d.pickCount > 0 && league.draft_status === "open" && (
        <div><button className="btn ghost small" disabled={busy} onClick={() => run(() => supabase.rpc("undo_last_pick", { p_league: league.id }), "Last pick undone.")}>Undo last pick</button></div>
      )}
      <div className="pickgrid">
        {sorted.map((c) => {
          const s = st[c.id];
          const taken = league.mode === "snake" && d.taken.has(c.id);
          const who = (owners[c.id] ?? []).map(teamName).join(", ");
          const mine = myRoster.includes(c.id);
          return (
            <div key={c.id} className={`pick ${taken || s.out !== null ? "taken" : ""}`}>
              <div className="who">
                <span className={`swatch ${s.out !== null ? "" : s.team}`} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{c.name}</div>
                  <div className="sub">{s.out !== null ? `Sent home in episode ${s.out}` : who ? `On ${who}` : `${s.team === "red" ? "Red" : "Blue"} team, ${c.age}`}</div>
                </div>
              </div>
              {mine && open && league.mode === "open" ? (
                <button className="btn ghost small" disabled={busy} onClick={() => run(() => supabase.rpc("drop_pick", { p_league: league.id, p_contestant: c.id, p_member: acting!.id }), "Removed.")}>Remove</button>
              ) : canPick(c.id) ? (
                <button className="btn brand small" disabled={busy} onClick={() => run(() => supabase.rpc("draft_pick", { p_league: league.id, p_contestant: c.id, p_member: acting!.id }), `${c.name} drafted.`)}>Draft</button>
              ) : null}
            </div>
          );
        })}
      </div>
      {d.order.length > 0 && (
        <div className="section">
          <h3>Teams so far</h3>
          <div className="table">
            {d.order.map((id) => (
              <div key={id} className="stand" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
                <div className="team">
                  <div className="tname">{teamName(id)}</div>
                  <div className="chips">
                    {picks.filter((p) => p.member_id === id).map((p) => chip(p.contestant_id))}
                    {!picks.some((p) => p.member_id === id) && <span className="soft small">No picks yet</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- weekly guess ---------- */
function Guess({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const n = nextEp?.num;
  const myGuess = acting && n ? guesses.find((g) => g.member_id === acting.id && g.episode_num === n)?.contestant_id ?? "" : "";
  const [pick, setPick] = useState(myGuess);
  const [winner, setWinner] = useState(acting?.winner_pick ?? "");
  const winnerLocked = episodes.some((e) => e.num >= league.start_episode && isLocked(e));
  const history = posted.filter((e) => e.num >= league.start_episode).reverse();
  const opts = active.map((c) => (
    <option key={c.id} value={c.id}>{c.name} ({st[c.id].team === "red" ? "Red" : "Blue"})</option>
  ));
  return (
    <section className="section">
      <h2>Weekly guess</h2>
      <p className="soft">
        Before each episode, guess who Chef Ramsay sends home. A correct guess earns {PTS.guess} points. If two chefs go home, either one counts.
        Guesses lock automatically when the episode starts{nextEp?.air_at ? ` (${fmtDate(nextEp.air_at)} at ${fmtTime(nextEp.air_at)} Eastern)` : ""}.
      </p>
      {pickFor}
      <div className="grid2">
        <div className="panel">
          <h3>{n ? `Who goes home in episode ${n}?` : "No episodes left"}</h3>
          {acting && n ? (
            <>
              <select id="guess-pick" value={pick} disabled={locked} onChange={(e) => setPick(e.target.value)} aria-label="Chef going home">
                <option value="">Choose a chef</option>
                {opts}
              </select>
              <button className="btn brand" disabled={locked || busy || !pick}
                onClick={() => run(() => supabase.rpc("set_guess", { p_league: league.id, p_episode: n, p_contestant: pick, p_member: acting.id }), `Guess saved: ${CHEF[pick]?.name}.`)}>
                {locked ? "Guesses are locked" : myGuess ? "Change my guess" : "Save my guess"}
              </button>
            </>
          ) : <span className="soft">Join the league to guess.</span>}
        </div>
        <div className="panel">
          <h3>Who wins the season?</h3>
          <span className="soft small">Worth {PTS.winnerPick} points at the finale. Locks when scoring starts.</span>
          {acting ? (
            <>
              <select id="winner-pick" value={winner} disabled={winnerLocked} onChange={(e) => setWinner(e.target.value)} aria-label="Season winner">
                <option value="">Choose a chef</option>
                {opts}
              </select>
              <button className="btn ghost" disabled={winnerLocked || busy || !winner}
                onClick={() => run(() => supabase.rpc("set_winner_pick", { p_league: league.id, p_contestant: winner, p_member: acting.id }), `Winner pick saved: ${CHEF[winner]?.name}.`)}>
                {winnerLocked ? "Locked" : "Save winner pick"}
              </button>
            </>
          ) : <span className="soft">Join the league to guess.</span>}
        </div>
      </div>
      {n && (
        <div className="section">
          <h3>Everyone&apos;s guess for episode {n}</h3>
          {!locked && <p className="soft small">Guesses stay hidden until the episode starts.</p>}
          <div className="table list calls">
            {members.map((m) => {
              const g = guesses.find((x) => x.member_id === m.id && x.episode_num === n);
              return (
                <div key={m.id} className="it">
                  <span>{m.team_name}</span>
                  <span>{g ? chip(g.contestant_id) : locked ? <span className="soft small">No guess</span> : <span className="soft small">Hidden until airtime</span>}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div className="section">
          <h3>Past guesses</h3>
          <div className="table list calls">
            {history.map((ep) => {
              const gone = [...ep.eliminated, ...ep.quit];
              return (
                <div key={ep.num} className="it">
                  <span><b>Episode {ep.num}</b> <span className="soft">{gone.length ? `${gone.map(first).join(" and ")} went home` : "nobody went home"}</span></span>
                  <span className="chips">
                    {members.map((m) => {
                      const g = guesses.find((x) => x.member_id === m.id && x.episode_num === ep.num);
                      if (!g) return null;
                      const hit = gone.includes(g.contestant_id);
                      return <span key={m.id} className={`chip ${hit ? "win" : "plain"}`}>{m.team_name}: {first(g.contestant_id)}{hit ? ` +${PTS.guess}` : ""}</span>;
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- chefs ---------- */
function Chefs({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const owners: Record<string, string[]> = {};
  for (const p of picks) (owners[p.contestant_id] ??= []).push(teamName(p.member_id));
  const card = (c: Contestant) => {
    const s = st[c.id];
    return (
      <div key={c.id} className={`chef ${s.out !== null ? "is-out" : ""}`}>
        <div style={{ minWidth: 0 }}>
          <div className="nm">
            {c.name} {s.winner ? <span className="chip win">Winner</span> : s.jacket && s.out === null ? <span className="chip jacket">Black jacket</span> : null}
          </div>
          <div className="meta">
            {s.out !== null ? `Sent home in episode ${s.out}. ` : ""}
            {owners[c.id]?.length ? `Drafted by ${owners[c.id].join(", ")}` : "Not drafted"}
          </div>
        </div>
        <div className="pts num">{s.pts}<small>pts</small></div>
        {s.log.length > 0 && (
          <details>
            <summary>See how they scored</summary>
            <ul className="log">
              {[...s.log].reverse().map((l) => (
                <li key={l.ep}>
                  <span className="ep">Ep {l.ep}</span>
                  <span>
                    {l.items.map((i) => `${i[0]} (${sign(i[1])})`).join(", ") || "Nothing scored"}
                    {!l.counted && <> <span className="badge">before scoring</span></>}
                  </span>
                  <b className={l.sum > 0 ? "up" : l.sum < 0 ? "down" : ""}>{sign(l.sum)}</b>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  };
  const by = (t: string) => active.filter((c) => st[c.id].team === t).sort((a, b) => st[b.id].pts - st[a.id].pts || a.name.localeCompare(b.name));
  const out = contestants.filter((c) => st[c.id].out !== null).sort((a, b) => (st[b.id].out ?? 0) - (st[a.id].out ?? 0));
  return (
    <section className="section">
      <h2>Chefs</h2>
      <p className="soft">Ranked by points within each team. Episodes before {league.start_episode} show in each chef&apos;s history but don&apos;t count.</p>
      <div className="teams">
        {(["red", "blue"] as const).map((t) => (
          <div key={t} className="teamcol">
            <div className={`kitchen ${t}`}><h3>{t === "red" ? "Red team" : "Blue team"}</h3><span className="small num">{by(t).length} left</span></div>
            {by(t).map(card)}
          </div>
        ))}
      </div>
      {out.length > 0 && (
        <div className="teamcol">
          <div className="kitchen gone"><h3>Sent home</h3><span className="small num">{out.length}</span></div>
          <div className="teams">{out.map(card)}</div>
        </div>
      )}
    </section>
  );
}

/* ---------- results ---------- */
function Results({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const names = (ids: string[]) => ids.map((id) => CHEF[id]?.name ?? id).join(", ");
  const teamWord = (v: Episode["challenge_win"]) =>
    v === "red" ? <span className="chip red">Red team</span> : v === "blue" ? <span className="chip blue">Blue team</span> : v === "both" ? <span className="chip plain">Both teams</span> : null;
  const line = (k: string, v: React.ReactNode) => (v && (typeof v !== "string" || v.length) ? <><dt>{k}</dt><dd>{v}</dd></> : null);
  return (
    <section className="section">
      <div className="sechead">
        <h2>Results</h2>
        {isSiteAdmin && <a className="btn brand small" href="/admin">Enter results</a>}
      </div>
      {posted.length ? (
        <div className="results">
          {[...posted].reverse().map((ep) => (
            <article key={ep.num} className="ep">
              <div className="ephead">
                <h3>Episode {ep.num}{ep.title ? `: ${ep.title}` : ""}</h3>
                <span className="when">{fmtDate(ep.air_at)} {ep.num < league.start_episode && <span className="badge">before scoring</span>}</span>
              </div>
              <dl>
                {line("Sent home", names([...ep.eliminated, ...ep.quit]))}
                {line("Up for elimination", names(ep.nominated))}
                {line("Won the challenge", teamWord(ep.challenge_win))}
                {line("Won dinner service", teamWord(ep.service_win))}
                {line("Standouts", names(ep.mvp))}
                {line("Kicked out of service", names(ep.ejected))}
                {line("Switched teams", names(ep.switched))}
                {line("Black jackets", names(ep.black_jacket))}
                {line("Final 2", names(ep.final2))}
                {line("Winner", ep.winner ? CHEF[ep.winner]?.name : "")}
              </dl>
              {ep.notes && <p className="soft small">{ep.notes}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty"><b>No results yet</b><span>Results go up after each episode airs, and everyone&apos;s points update.</span></div>
      )}
    </section>
  );
}

/* ---------- how to play ---------- */
function Rules({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const l = (t: string, p: number) => <div className="l" key={t}><span>{t}</span><b className={p > 0 ? "up" : "down"}>{sign(p)}</b></div>;
  return (
    <section className="section">
      <h2>How to play</h2>
      <ol className="steps">
        <li><h3>Join</h3><span className="soft">Open the invite link and name your team.</span></li>
        <li><h3>Draft</h3><span className="soft">{league.mode === "snake" ? `Take turns picking ${league.roster_size} chefs. Each chef can only be on one team.` : `Pick ${league.roster_size} chefs. Friends can pick the same ones.`}</span></li>
        <li><h3>Score</h3><span className="soft">Your chefs earn points every episode from episode {league.start_episode} on. Most points at the finale wins.</span></li>
      </ol>
      <div className="ptsgrid">
        <div className="ptlist"><h3>Each episode</h3>{l("Stays in the competition", PTS.survive)}{l("Their team wins the challenge", PTS.challenge)}{l("Their team wins dinner service", PTS.service)}{l("Standout of the night (best dish, challenge win, punishment pass)", PTS.mvp)}</div>
        <div className="ptlist"><h3>Elimination</h3>{l("Put up for elimination", PTS.nominated)}{l("Survives elimination", PTS.survivedBlock)}{l("Kicked out of dinner service", PTS.ejected)}{l("Sent home", PTS.eliminated)}{l("Quits or leaves for medical reasons", PTS.quit)}{l("Switches teams", PTS.switched)}</div>
        <div className="ptlist"><h3>End of the season</h3>{l("Earns a black jacket", PTS.blackJacket)}{l("Makes the final 2", PTS.final2)}{l("Wins the season", PTS.winner)}</div>
        <div className="ptlist"><h3>Your guesses</h3>{l("Correctly guess who goes home", PTS.guess)}{l("Correctly guess the season winner", PTS.winnerPick)}</div>
      </div>
      <p className="soft small">
        Being up for elimination costs {Math.abs(PTS.nominated)} points, but surviving it pays {PTS.survivedBlock}, so a chef who keeps escaping still helps you.
        When a chef goes home, they stop earning but keep the points they made. Ties go to whoever has more correct weekly guesses.
      </p>
    </section>
  );
}

/* ---------- commissioner ---------- */
function Commish({ x }: { x: Ctx }) {
const { league, members, picks, guesses, contestants, episodes, profiles, CHEF, st, me, isCommish, isSiteAdmin, acting, d, nextEp, locked, posted, lastNum, teamName, managerName, first, active, chip, pickFor, run, busy, supabase, flash, setConfirm, setTab } = x;
  const [form, setForm] = useState({ name: league.name, mode: league.mode, roster: league.roster_size, start: league.start_episode });
  const [addTeam, setAddTeam] = useState("");
  const [addMgr, setAddMgr] = useState("");
  const link = typeof window !== "undefined" ? `${window.location.origin}/join/${league.invite_code}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      flash("Invite link copied.");
    } catch {
      flash("Copy didn't work. Select the link and copy it.");
    }
  };
  return (
    <section className="section">
      <h2>Commissioner</h2>
      <div className="panel">
        <h3>Invite friends</h3>
        <div className="invite"><code>{link}</code><button className="btn brand small" onClick={copy}>Copy link</button></div>
        <span className="soft small">Anyone with the link can sign in with Google and join until the draft opens. Invite code: <b>{league.invite_code}</b></span>
      </div>

      <div className="panel">
        <h3>League settings</h3>
        <div className="grid2">
          <label className="field">League name<input id="set-name" type="text" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Draft style
            <select id="set-mode" value={form.mode} disabled={league.draft_status !== "setup"} onChange={(e) => setForm({ ...form, mode: e.target.value as League["mode"] })}>
              <option value="snake">Take turns (each chef once)</option>
              <option value="open">Free pick (chefs can repeat)</option>
            </select>
          </label>
          <label className="field">Chefs per team<input id="set-roster" type="number" min={1} max={9} value={form.roster} disabled={league.draft_status !== "setup"} onChange={(e) => setForm({ ...form, roster: Number(e.target.value) })} /></label>
          <label className="field">Points count from episode<input id="set-start" type="number" min={1} max={30} value={form.start} onChange={(e) => setForm({ ...form, start: Number(e.target.value) })} /></label>
        </div>
        <div className="row">
          <button className="btn" disabled={busy}
            onClick={() => run(() => supabase.from("leagues").update({ name: form.name.trim() || league.name, mode: form.mode, roster_size: Math.max(1, Math.min(9, form.roster || 3)), start_episode: Math.max(1, form.start || 1) }).eq("id", league.id), "Settings saved.")}>
            Save settings
          </button>
          <span className="soft small">Draft style and team size lock once the draft opens.</span>
        </div>
      </div>

      <div className="panel">
        <h3>Draft</h3>
        <div className="order">
          {d.order.length ? d.order.map((id, i) => <span key={id} className="chip plain">{i + 1}. {teamName(id)}</span>) : <span className="soft">No teams yet.</span>}
        </div>
        <div className="row">
          {league.draft_status === "setup" && (
            <>
              <button className="btn ghost" disabled={busy || d.order.length < 2} onClick={() => run(() => supabase.rpc("shuffle_draft_order", { p_league: league.id }), "Draft order shuffled.")}>Shuffle order</button>
              <button className="btn brand" disabled={busy || !d.order.length} onClick={() => run(() => supabase.rpc("open_draft", { p_league: league.id }), "The draft is open.")}>Open the draft</button>
            </>
          )}
          {league.draft_status === "open" && (
            <>
              <button className="btn" disabled={busy} onClick={() => run(() => supabase.from("leagues").update({ draft_status: "closed" }).eq("id", league.id), "Draft closed. Teams are set.")}>Close the draft</button>
              <button className="btn ghost" disabled={busy} onClick={() => run(() => supabase.from("leagues").update({ draft_status: "setup" }).eq("id", league.id), "Draft back in setup.")}>Back to setup</button>
            </>
          )}
          {league.draft_status === "closed" && (
            <button className="btn ghost" disabled={busy} onClick={() => run(() => supabase.from("leagues").update({ draft_status: "open" }).eq("id", league.id), "Draft reopened.")}>Reopen the draft</button>
          )}
          {d.pickCount > 0 && (
            <button className="btn danger" disabled={busy} onClick={() => setConfirm({ text: "Clear every team's picks?", yes: "Clear picks", run: () => run(() => supabase.rpc("reset_picks", { p_league: league.id }), "All picks cleared.") })}>Clear all picks</button>
          )}
        </div>
        <p className="soft small">
          Status: <b>{league.draft_status === "setup" ? "not open yet" : league.draft_status === "open" ? (d.done ? "all picks made" : "open") : "closed"}</b>.
          Opening the draft locks the order. In a take-turns draft, new people can&apos;t join after that, but you can add them below. Use &quot;Clear all picks&quot; after a practice run.
        </p>
      </div>

      <div className="panel">
        <h3>Players</h3>
        <form className="row" onSubmit={(e) => {
          e.preventDefault();
          if (!addTeam.trim()) return flash("Give the team a name.");
          run(() => supabase.from("league_members").insert({ league_id: league.id, team_name: addTeam.trim(), manager_name: addMgr.trim() || null }), `${addTeam.trim()} added.`).then((ok) => { if (ok) { setAddTeam(""); setAddMgr(""); } });
        }}>
          <input id="add-team" type="text" maxLength={40} placeholder="Team name" value={addTeam} onChange={(e) => setAddTeam(e.target.value)} aria-label="Team name" />
          <input id="add-mgr" type="text" maxLength={40} placeholder="Player's name" value={addMgr} onChange={(e) => setAddMgr(e.target.value)} aria-label="Player's name" />
          <button className="btn" disabled={busy}>Add player</button>
        </form>
        <p className="soft small">For friends who won&apos;t use the site. Use &quot;Picking for&quot; on the Draft and Weekly guess tabs to pick for them.</p>
        <div className="list">
          {members.map((m) => (
            <div key={m.id} className="it">
              <span><b>{m.team_name}</b> <span className="soft">{managerName(m)}{m.role === "commissioner" ? ", commissioner" : ""}</span></span>
              <span className="row">
                {m.user_id && m.id !== me?.id && (
                  <button className="btn ghost small" disabled={busy}
                    onClick={() => run(() => supabase.rpc("set_member_role", { p_member: m.id, p_role: m.role === "commissioner" ? "player" : "commissioner" }), m.role === "commissioner" ? "Commissioner removed." : `${m.team_name} is now a commissioner.`)}>
                    {m.role === "commissioner" ? "Remove commissioner" : "Make commissioner"}
                  </button>
                )}
                {m.id !== me?.id && (
                  <button className="btn danger small" disabled={busy}
                    onClick={() => setConfirm({ text: `Remove ${m.team_name} from the league? Their picks and guesses are deleted too.`, yes: "Remove", run: () => run(() => supabase.from("league_members").delete().eq("id", m.id), "Removed.") })}>
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const VIEWS: Record<Tab, (p: { x: Ctx }) => React.ReactNode> = { standings: Standings, draft: Draft, guess: Guess, chefs: Chefs, results: Results, rules: Rules, commish: Commish };
