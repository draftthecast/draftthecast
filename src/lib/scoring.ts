import type { Contestant, Episode, FlagKey, Guess, League, Member, Pick, Team } from "./types.ts";

export const PTS = {
  survive: 2,
  challenge: 2,
  service: 2,
  mvp: 3,
  nominated: -2,
  survivedBlock: 3,
  ejected: -3,
  eliminated: -3,
  quit: -5,
  switched: 1,
  blackJacket: 10,
  final2: 10,
  winner: 25,
  guess: 5,
  winnerPick: 15,
} as const;

export const FLAGS: [FlagKey, string][] = [
  ["mvp", "Standout"],
  ["nominated", "Up for elimination"],
  ["ejected", "Kicked out"],
  ["eliminated", "Sent home"],
  ["quit", "Quit or medical"],
  ["switched", "Switched team"],
  ["black_jacket", "Black jacket"],
  ["final2", "Final 2"],
];

export type ScoreItem = [label: string, points: number];

export interface ChefState {
  team: Team;
  out: number | null;
  pts: number;
  log: { ep: number; items: ScoreItem[]; sum: number; counted: boolean }[];
  jacket: boolean;
  final2: boolean;
  winner: boolean;
}

const has = (ep: Episode, key: FlagKey, id: string) => (ep[key] ?? []).includes(id);

export function episodeItems(ep: Episode, id: string, team: Team): ScoreItem[] {
  const items: ScoreItem[] = [];
  const out = has(ep, "eliminated", id) || has(ep, "quit", id);
  const won = (v: Episode["challenge_win"]) => v === team || v === "both";
  if (!out) items.push(["Stayed in", PTS.survive]);
  if (won(ep.challenge_win)) items.push(["Team won the challenge", PTS.challenge]);
  if (won(ep.service_win)) items.push(["Team won dinner service", PTS.service]);
  if (has(ep, "mvp", id)) items.push(["Standout of the night", PTS.mvp]);
  if (has(ep, "nominated", id)) items.push(["Up for elimination", PTS.nominated]);
  if (has(ep, "nominated", id) && !out) items.push(["Survived elimination", PTS.survivedBlock]);
  if (has(ep, "ejected", id)) items.push(["Kicked out of service", PTS.ejected]);
  if (has(ep, "eliminated", id)) items.push(["Sent home", PTS.eliminated]);
  if (has(ep, "quit", id)) items.push(["Left the competition", PTS.quit]);
  if (has(ep, "switched", id)) items.push(["Switched teams", PTS.switched]);
  if (has(ep, "black_jacket", id)) items.push(["Earned a black jacket", PTS.blackJacket]);
  if (has(ep, "final2", id)) items.push(["Made the final 2", PTS.final2]);
  if (ep.winner === id) items.push(["Won the season", PTS.winner]);
  const bonus = Number(ep.bonus?.[id] ?? 0);
  if (bonus) items.push(["Bonus", bonus]);
  return items;
}

/** Walk posted episodes in order. `beforeNum` stops before that episode (used by the results editor). */
export function chefStates(
  contestants: Contestant[],
  episodes: Episode[],
  startEpisode: number,
  beforeNum?: number,
): Record<string, ChefState> {
  const st: Record<string, ChefState> = {};
  for (const c of contestants) st[c.id] = { team: c.team, out: null, pts: 0, log: [], jacket: false, final2: false, winner: false };
  const posted = episodes.filter((e) => e.posted).sort((a, b) => a.num - b.num);
  for (const ep of posted) {
    if (beforeNum !== undefined && ep.num >= beforeNum) break;
    for (const c of contestants) {
      const s = st[c.id];
      if (s.out !== null) continue;
      const items = episodeItems(ep, c.id, s.team);
      const sum = items.reduce((a, i) => a + i[1], 0);
      const counted = ep.num >= startEpisode;
      if (counted) s.pts += sum;
      s.log.push({ ep: ep.num, items, sum, counted });
      if (has(ep, "eliminated", c.id) || has(ep, "quit", c.id)) s.out = ep.num;
      if (has(ep, "switched", c.id)) s.team = s.team === "red" ? "blue" : "red";
      if (has(ep, "black_jacket", c.id)) s.jacket = true;
      if (has(ep, "final2", c.id)) s.final2 = true;
      if (ep.winner === c.id) s.winner = true;
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
  league: League,
  members: Member[],
  picks: Pick[],
  guesses: Guess[],
  episodes: Episode[],
  st: Record<string, ChefState>,
): StandingRow[] {
  const posted = episodes.filter((e) => e.posted).sort((a, b) => a.num - b.num);
  const last = posted.length ? posted[posted.length - 1].num : 0;
  const champ = posted.map((e) => e.winner).find(Boolean) ?? null;
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
        if ([...ep.eliminated, ...ep.quit].includes(g.contestant_id)) {
          guessPts += PTS.guess;
          correctGuesses += 1;
          if (ep.num === last) lastPts += PTS.guess;
        }
      }
      const winnerPts = champ && m.winner_pick === champ ? PTS.winnerPick : 0;
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

/** The next episode whose results aren't posted yet. */
export function nextEpisode(episodes: Episode[]): Episode | null {
  return [...episodes].sort((a, b) => a.num - b.num).find((e) => !e.posted) ?? null;
}

export function isLocked(ep: Episode | null, now = Date.now()): boolean {
  if (!ep) return true;
  return ep.posted || (!!ep.air_at && new Date(ep.air_at).getTime() <= now);
}
