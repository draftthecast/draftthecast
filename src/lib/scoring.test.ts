import { test } from "node:test";
import assert from "node:assert/strict";
import { chefStates, draftInfo, effectiveEpisodes, firstUnposted, nextEpisode, outIds, standings } from "./scoring.ts";
import { SHOWS, scoringGroups, showByKey } from "./shows.ts";
import type { Contestant, Episode, League, Member, Pick } from "./types.ts";

const HK = showByKey("hells-kitchen");
const TR = showByKey("traitors");
const c = (id: string, team: "red" | "blue" | null): Contestant => ({ season_id: "hk25", id, name: id, team, age: 22, hometown: null });
const ep = (num: number, patch: Partial<Episode>): Episode => ({
  season_id: "hk25", num, title: null, air_at: null, posted: true, challenge_win: null, service_win: null,
  mvp: [], nominated: [], ejected: [], eliminated: [], quit: [], switched: [], black_jacket: [], final2: [],
  winner: null, bonus: {}, notes: null, ...patch,
});
const cast = [c("mike", "blue"), c("diego", "blue"), c("mya", "red"), c("reni", "red")];
const eps = [
  ep(1, { challenge_win: "blue", mvp: ["diego", "mya"] }),
  ep(2, { service_win: "blue", mvp: ["mya", "mike"], nominated: ["reni"], eliminated: ["reni"] }),
];

test("chef points match the scoring table", () => {
  const st = chefStates(HK, cast, eps, 1);
  assert.equal(st.mike.pts, 4 + 4); // ep1 stay+challenge, ep2 stay+service (standouts don't score in Hell's Kitchen)
  assert.equal(st.diego.pts, 4 + 4);
  assert.equal(st.mya.pts, 2 + 2);
  assert.equal(st.reni.pts, 2 + (-2 - 3));
  assert.equal(st.reni.out, 2);
});

test("episodes before the start episode don't count", () => {
  const st = chefStates(HK, cast, eps, 2);
  assert.equal(st.mike.pts, 4);
  assert.equal(st.mike.log.length, 2);
});

test("standings add guesses and sort by total", () => {
  const league = { id: "L", start_episode: 1, mode: "snake", draft_status: "closed", draft_order: [], roster_size: 2 } as unknown as League;
  const m = (id: string): Member => ({ id, league_id: "L", user_id: id, team_name: id, manager_name: null, role: "player", winner_pick: null, joined_at: "2026-10-01" });
  const picks: Pick[] = [
    { id: "1", league_id: "L", member_id: "a", contestant_id: "mya", pick_no: 0 },
    { id: "2", league_id: "L", member_id: "b", contestant_id: "mike", pick_no: 1 },
  ];
  const rows = standings(HK, league, [m("a"), m("b")], picks, [{ league_id: "L", member_id: "a", episode_num: 2, contestant_id: "reni" }], eps, chefStates(HK, cast, eps, 1));
  assert.equal(rows[0].member.id, "a");
  assert.equal(rows[0].total, 4 + 5);
  assert.equal(rows[0].lastPts, 2 + 5);
});

test("snake order reverses each round", () => {
  const league = { mode: "snake", draft_status: "open", draft_order: ["a", "b", "c"], roster_size: 2 } as unknown as League;
  const members = ["a", "b", "c"].map((id) => ({ id, joined_at: "x" }) as Member);
  const picks = (k: number) => Array.from({ length: k }, (_, i) => ({ contestant_id: "x" + i }) as Pick);
  const turns = [0, 1, 2, 3, 4, 5].map((k) => draftInfo(league, members, picks(k)).turn);
  assert.deepEqual(turns, ["a", "b", "c", "c", "b", "a"]);
  assert.equal(draftInfo(league, members, picks(6)).done, true);
});

test("a league's own results replace the site-wide ones for that episode", () => {
  const season = [...eps, ep(3, { posted: false, air_at: "2026-10-08T20:00:00-04:00" })];
  const own = [{ ...ep(3, { eliminated: ["mike"] }), league_id: "L", updated_by: null, updated_at: "" }];
  const merged = effectiveEpisodes(season, own as never);
  assert.equal(merged.length, 3);
  assert.equal(merged[2].posted, true);
  assert.deepEqual(merged[2].eliminated, ["mike"]);
  assert.equal(merged[2].air_at, "2026-10-08T20:00:00-04:00");
  assert.equal(chefStates(HK, cast, merged, 1).mike.out, 3);
});

test("hell's kitchen scoring table is unchanged", () => {
  const rows = Object.fromEntries(scoringGroups(HK).flatMap((g) => g.rows));
  assert.equal(rows["Put up for elimination"], -2);
  assert.equal(rows["Survives elimination"], 3);
  assert.equal(rows["Earns a black jacket"], 10);
  assert.ok(!Object.keys(rows).some((k) => k.toLowerCase().includes("standout")), "Hell's Kitchen has no standout points");
  assert.equal(rows["Wins the season"], 25);
});

const tcast = [c("joe", null), c("kim", null), c("madeline", null), c("victor", null)];
const teps = [
  ep(1, { events: { traitor: ["joe"], shield: ["victor", "madeline"] } }),
  ep(2, { events: { murdered: ["kim"], close_call: ["victor"] }, eliminated: ["madeline"] }),
];

test("traitors scoring uses events and has no teams", () => {
  const st = chefStates(TR, tcast, teps, 1);
  assert.equal(st.joe.pts, 2 + 5 + 2);
  assert.equal(st.joe.traitor, true);
  assert.equal(st.joe.team, null);
  assert.equal(st.victor.pts, 2 + 3 + 2 + 2);
  assert.equal(st.kim.pts, 2 - 2);
  assert.equal(st.kim.out, 2);
  assert.equal(st.madeline.pts, 2 + 3 - 4);
  assert.equal(st.madeline.out, 2);
  assert.deepEqual(outIds(TR, teps[1]).sort(), ["kim", "madeline"]);
});

test("traitors guesses count murders and banishments, and several winners share the title", () => {
  const league = { id: "L", start_episode: 1 } as unknown as League;
  const m = (id: string, winner_pick: string | null = null): Member => ({ id, league_id: "L", user_id: id, team_name: id, manager_name: null, role: "player", winner_pick, joined_at: "x" });
  const fin = [...teps, ep(3, { final2: ["joe", "victor"], events: { winners: ["joe", "victor"] } })];
  const st = chefStates(TR, tcast, fin, 1);
  assert.equal(st.victor.winner && st.joe.winner, true);
  const guesses = [
    { league_id: "L", member_id: "a", episode_num: 2, contestant_id: "kim" },
    { league_id: "L", member_id: "b", episode_num: 2, contestant_id: "madeline" },
  ];
  const rows = standings(TR, league, [m("a", "victor"), m("b")], [], guesses, fin, st);
  const a = rows.find((r) => r.member.id === "a")!;
  const b = rows.find((r) => r.member.id === "b")!;
  assert.equal(a.guessPts, 5);
  assert.equal(b.guessPts, 5);
  assert.equal(a.winnerPts, 15);
});

test("every show's events have unique keys", () => {
  for (const s of SHOWS) assert.equal(new Set(s.events.map((e) => e.key)).size, s.events.length, s.key);
});

test("a held episode that already aired doesn't block guessing on the next one", () => {
  const now = Date.parse("2026-10-19T12:00:00-04:00");
  const sched = [
    ep(3, {}),
    ep(4, { posted: false, air_at: "2026-10-15T20:00:00-04:00" }),
    ep(5, { posted: false, air_at: "2026-10-22T20:00:00-04:00" }),
  ];
  assert.equal(nextEpisode(sched, now)?.num, 5);
  assert.equal(firstUnposted(sched)?.num, 4);
  assert.equal(nextEpisode(sched.slice(0, 2), now)?.num, 4);
});
