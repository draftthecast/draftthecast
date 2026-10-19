import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOW_FIELDS, LIST_COLUMNS } from "./show-fields.mjs";
import { SHOWS, COLUMN_EVENTS } from "../src/lib/shows.ts";

test("episode-file fields match every show's events", () => {
  assert.deepEqual([...LIST_COLUMNS].sort(), [...COLUMN_EVENTS].sort());
  for (const show of SHOWS) {
    const map = SHOW_FIELDS[show.key];
    assert.ok(map, `no file mapping for ${show.key}`);
    const stored = Object.values(map.lists).map((v) => v.split(":")[1]).sort();
    assert.deepEqual(stored, show.events.map((e) => e.key).sort(), show.key);
    assert.deepEqual(map.teamResults, show.teamResults.map((t) => t.key), show.key);
    assert.equal(map.winnerColumn, !show.multiWinner, show.key);
    assert.equal(map.name, show.name, show.key);
  }
});
