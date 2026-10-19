import type { Contestant, Episode, Guess, League, LeagueResult, Member, Pick, Team } from "./types.ts";
import { COLUMN_EVENTS, type ShowDef } from "./shows.ts";

export type ScoreItem = [label: string, points: number];

export interface ChefState {
  team: Team | null;
  out: number | null;
  pts: number;
  log: { ep: number; items: ScoreItem[]; sum: number; counted: boolean }[];
  jacket: boolean;
  traitor: boolean;
  final2: boolean;
  winner: boolean;
}

const COLUMNS = new Set<string>(COLUMN_EVENTS);

/** Contestant ids for one result field, whether it has its own column or lives in `events`. */
export function eventIds(ep: Episode, key: string): string[] {
  if (COLUMNS.has(key)) return ((ep as unknown as Record<string, string[] | undefined>)[key]) ?? [];
  return ep.events?.[key] ?? [];
}

const has = (ep: Episode, key: string, id: string) => eventIds(ep, key).includes(id);

/** Everyone who left the game in this episode. */
export function outIds(show: ShowDef, ep: Episode): string[] {
  return show.events.filter((e) => e.out).flatMap((e) => eventIds(ep, e.key));
}

export function winnerIds(ep: Episode): string[] {
  return [...(ep.winner ? [ep.winner] : []), ...eventIds(ep, "winners")];
}

export function episodeItems(show: ShowDef, ep: Episode, id: string, team: Team | null): ScoreItem[] {
  const items: ScoreItem[] = [];
  const out = outIds(show, ep).includes(id);
  if (!out) items.push(["Stayed in", show.survive]);
  for (const t of show.teamResults) {
    const v = ep[t.key];
    if (team && (v === team || v === "both")) items.push([t.scored, t.pts]);
  }
  for (const e of show.events) {
    if (e.key === "winners") continue;
    if (!has(ep, e.key, id)) continue;
    items.push([e.scored, e.pts]);
    if (e.key === "nominated" && show.survivedBlock && !out) items.push(["Survived elimination", show.survivedBlock.pts]);
  }
  if (winnerIds(ep).includes(id)) items.push(["Won the season", show.winnerPts]);
  const bonus = Number(ep.bonus?.[id] ?? 0);
  if (bonus) items.push(["Bonus", bonus]);
  return items;
}

/** Walk posted episodes in order. `beforeNum` stops before that episode (used by the results editor). */
export function chefStates(
  show: ShowDef,
  contestants: Contestant[],
  episodes: Episode[],
  startEpisode: number,
  beforeNum?: number,
): Record<string, ChefState> {
  const st: Record<string, ChefState> = {};
  for (const c of contestants)
    st[c.id] = { team: show.teams ? c.team : null, out: null, pts: 0, log: [], jacket: false, traitor: false, final2: false, winner: false };
  const posted = episodes.filter((e) => e.posted).sort((a, b) => a.num - b.num);
  for (const ep of posted) {
    if (beforeNum !== undefined && ep.num >= beforeNum) break;
    const gone = outIds(show, ep);
    const won = winnerIds(ep);
    for (const c of contestants) {
      const s = st[c.id];
      if (s.out !== null) continue;
      const items = episodeItems(show, ep, c.id, s.team);
      const sum = items.reduce((a, i) => a + i[1], 0);
      const counted = ep.num >= startEpisode;
      if (counted) s.pts += sum;
      s.log.push({ ep: ep.num, items, sum, counted });
      if (gone.includes(c.id)) s.out = ep.num;
      if (has(ep, "switched", c.id) && s.team) s.team = s.team === "red" ? "blue" : "red";
      if (has(ep, "black_jacket", c.id)) s.jacket = true;
      if (has(ep, "traitor", c.id)) s.traitor = true;
      if (has(ep, "final2", c.id)) s.final2 = true;
      if (won.includes(c.id)) s.winner = true;
    }
  }
  return st;
}

export interface StandingRow {
  member: Member;
  roster: string[];
  chefPts: number;
  guessPts: number;
  winnerPts: number;
  total: number;
  lastPts: number;
  correctGuesses: number;
}

export function standings(
  show: ShowDef,
  league: League,
  members: Member[],
  picks: Pick[],
  guesses: Guess[],
  episodes: Episode[],
  st: Record<string, ChefState>,
): StandingRow[] {
  const posted = episodes.filter((e) => e.posted).sort((a, b) => a.num - b.num);
  const last = posted.length ? posted[posted.length - 1].num : 0;
  const champs = new Set(posted.flatMap(winnerIds));
  const byNum = new Map(posted.map((e) => [e.num, e]));
  return members
    .map((m) => {
      const roster = picks.filter((p) => p.member_id === m.id).sort((a, b) => a.pick_no - b.pick_no).map((p) => p.contestant_id);
      let chefPts = 0;
      let lastPts = 0;
      for (const cid of roster) {
        const s = st[cid];
        if (!s) continue;
        chefPts += s.pts;
        const l = s.log.find((x) => x.ep === last);
        if (l && l.counted) lastPts += l.sum;
      }
      let guessPts = 0;
      let correctGuesses = 0;
      for (const g of guesses.filter((g) => g.member_id === m.id)) {
        const ep = byNum.get(g.episode_num);
        if (!ep || ep.num < league.start_episode) continue;
        if (outIds(show, ep).includes(g.contestant_id)) {
          guessPts += show.guessPts;
          correctGuesses += 1;
          if (ep.num === last) lastPts += show.guessPts;
        }
      }
      const winnerPts = m.winner_pick && champs.has(m.winner_pick) ? show.winnerPickPts : 0;
      return { member: m, roster, chefPts, guessPts, winnerPts, total: chefPts + guessPts + winnerPts, lastPts, correctGuesses };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.correctGuesses - a.correctGuesses ||
        a.member.team_name.localeCompare(b.member.team_name),
    );
}

export interface DraftInfo {
  order: string[];
  n: number;
  rosterSize: number;
  pickCount: number;
  total: number;
  turn: string | null;
  taken: Set<string>;
  done: boolean;
}

/** Mirrors the snake-draft turn logic in the database's draft_pick function. */
export function draftInfo(league: League, members: Member[], picks: Pick[]): DraftInfo {
  const ids = new Set(members.map((m) => m.id));
  let order = league.draft_order.filter((id) => ids.has(id));
  if (league.draft_status === "setup") {
    const rest = members
      .filter((m) => !order.includes(m.id))
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((m) => m.id);
    order = [...order, ...rest];
  }
  const n = order.length;
  const R = league.roster_size;
  const k = picks.length;
  const total = n * R;
  let turn: string | null = null;
  if (league.mode === "snake" && league.draft_status === "open" && k < total && n) {
    const round = Math.floor(k / n);
    const pos = k % n;
    turn = round % 2 === 0 ? order[pos] : order[n - 1 - pos];
  }
  return {
    order,
    n,
    rosterSize: R,
    pickCount: k,
    total,
    turn,
    taken: new Set(picks.map((p) => p.contestant_id)),
    done: league.mode === "snake" ? n > 0 && k >= total : false,
  };
}

/** The first episode whose results aren't posted yet (aired or not). Results get entered for this one. */
export function firstUnposted(episodes: Episode[]): Episode | null {
  return [...episodes].sort((a, b) => a.num - b.num).find((e) => !e.posted) ?? null;
}

/**
 * The episode people guess on next: the first unposted one that hasn't aired yet.
 * A held (unposted) episode that already aired doesn't block guessing on the one after it.
 * Falls back to the first unposted episode when nothing later is on the schedule.
 */
export function nextEpisode(episodes: Episode[], now = Date.now()): Episode | null {
  const sorted = [...episodes].sort((a, b) => a.num - b.num).filter((e) => !e.posted);
  return sorted.find((e) => !e.air_at || new Date(e.air_at).getTime() > now) ?? sorted[0] ?? null;
}

export function isLocked(ep: Episode | null, now = Date.now()): boolean {
  if (!ep) return true;
  return ep.posted || (!!ep.air_at && new Date(ep.air_at).getTime() <= now);
}

/** Site-wide episodes with this league's own results laid over them, episode by episode. */
export function effectiveEpisodes(season: Episode[], league: LeagueResult[]): Episode[] {
  // Keep only the result fields from a league row; schedule fields always come from the site-wide episode.
  const resultsOf = (r: LeagueResult) => {
    const { league_id: _l, updated_by: _u, updated_at: _t, season_id: _s, title: _ti, air_at: _a, ...rest } =
      r as LeagueResult & { season_id?: string; title?: string | null; air_at?: string | null };
    return rest;
  };
  const own = new Map(league.map((r) => [r.num, r]));
  const out: Episode[] = season.map((e) => {
    const r = own.get(e.num);
    return r ? { ...e, ...resultsOf(r), fromLeague: true } : e;
  });
  for (const r of league) {
    if (season.some((e) => e.num === r.num)) continue;
    out.push({ ...resultsOf(r), season_id: "", title: null, air_at: null, fromLeague: true });
  }
  return out.sort((a, b) => a.num - b.num);
}
