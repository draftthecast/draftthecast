import { test } from "node:test";
import assert from "node:assert/strict";
import { chefStates, draftInfo, standings } from "./scoring.ts";
import type { Contestant, Episode, League, Member, Pick } from "./types.ts";

const c = (id: string, team: "red" | "blue"): Contestant => ({ season_id: "hk25", id, name: id, team, age: 22, hometown: null });
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
  const st = chefStates(cast, eps, 1);
  assert.equal(st.mike.pts, 4 + 7); // ep1 stay+challenge, ep2 stay+service+standout
  assert.equal(st.diego.pts, 7 + 4);
  assert.equal(st.mya.pts, 5 + 5);
  assert.equal(st.reni.pts, 2 + (-2 - 3));
  assert.equal(st.reni.out, 2);
});

test("episodes before the start episode don't count", () => {
  const st = chefStates(cast, eps, 2);
  assert.equal(st.mike.pts, 7);
  assert.equal(st.mike.log.length, 2);
});

test("standings add guesses and sort by total", () => {
  const league = { id: "L", start_episode: 1, mode: "snake", draft_status: "closed", draft_order: [], roster_size: 2 } as unknown as League;
  const m = (id: string): Member => ({ id, league_id: "L", user_id: id, team_name: id, manager_name: null, role: "player", winner_pick: null, joined_at: "2026-10-01" });
  const picks: Pick[] = [
    { id: "1", league_id: "L", member_id: "a", contestant_id: "mya", pick_no: 0 },
    { id: "2", league_id: "L", member_id: "b", contestant_id: "mike", pick_no: 1 },
  ];
  const rows = standings(league, [m("a"), m("b")], picks, [{ league_id: "L", member_id: "a", episode_num: 2, contestant_id: "reni" }], eps, chefStates(cast, eps, 1));
  assert.equal(rows[0].member.id, "a");
  assert.equal(rows[0].total, 10 + 5);
  assert.equal(rows[0].lastPts, 5 + 5);
});

test("snake order reverses each round", () => {
  const league = { mode: "snake", draft_status: "open", draft_order: ["a", "b", "c"], roster_size: 2 } as unknown as League;
  const members = ["a", "b", "c"].map((id) => ({ id, joined_at: "x" }) as Member);
  const picks = (k: number) => Array.from({ length: k }, (_, i) => ({ contestant_id: "x" + i }) as Pick);
  const turns = [0, 1, 2, 3, 4, 5].map((k) => draftInfo(league, members, picks(k)).turn);
  assert.deepEqual(turns, ["a", "b", "c", "c", "b", "a"]);
  assert.equal(draftInfo(league, members, picks(6)).done, true);
});
