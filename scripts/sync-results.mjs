// Copies episode results from data/<season>/ep-NN.json into Supabase.
// Run by the "Sync results" GitHub Action on every push that touches data/.
//   node scripts/sync-results.mjs --check   validate files only (no network)
//   node scripts/sync-results.mjs           validate, then upsert into Supabase
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment for the upsert.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA = new URL("../data/", import.meta.url).pathname;
const LIST_FIELDS = ["mvp", "nominated", "ejected", "eliminated", "quit", "switched", "black_jacket", "final2"];
const TEAM = new Set(["red", "blue", "both", null]);
const checkOnly = process.argv.includes("--check");

const errors = [];
const rows = [];

for (const season of readdirSync(DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const dir = join(DATA, season);
  const castFile = join(dir, "contestants.json");
  if (!existsSync(castFile)) {
    errors.push(`${season}: missing contestants.json`);
    continue;
  }
  const cast = JSON.parse(readFileSync(castFile, "utf8"));
  const ids = new Set([...Object.keys(cast.red ?? {}), ...Object.keys(cast.blue ?? {})]);

  for (const file of readdirSync(dir).filter((f) => /^ep-\d+\.json$/.test(f)).sort()) {
    const where = `${season}/${file}`;
    let ep;
    try {
      ep = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (e) {
      errors.push(`${where}: not valid JSON (${e.message})`);
      continue;
    }
    const num = Number(file.match(/\d+/)[0]);
    if (ep.num !== num) errors.push(`${where}: "num" is ${ep.num} but the file name says ${num}`);
    if (typeof ep.posted !== "boolean") errors.push(`${where}: "posted" must be true or false`);
    if (ep.air_at && Number.isNaN(Date.parse(ep.air_at))) errors.push(`${where}: "air_at" isn't a valid date`);
    for (const k of ["challenge_win", "service_win"]) {
      if (!TEAM.has(ep[k] ?? null)) errors.push(`${where}: "${k}" must be "red", "blue", "both" or null`);
    }
    for (const k of LIST_FIELDS) {
      const v = ep[k] ?? [];
      if (!Array.isArray(v)) errors.push(`${where}: "${k}" must be a list`);
      else for (const id of v) if (!ids.has(id)) errors.push(`${where}: unknown chef id "${id}" in "${k}"`);
    }
    if (ep.winner && !ids.has(ep.winner)) errors.push(`${where}: unknown chef id "${ep.winner}" in "winner"`);
    for (const id of Object.keys(ep.bonus ?? {})) if (!ids.has(id)) errors.push(`${where}: unknown chef id "${id}" in "bonus"`);

    rows.push({
      season_id: season,
      num,
      title: ep.title ?? null,
      air_at: ep.air_at ? new Date(ep.air_at).toISOString() : null,
      posted: !!ep.posted,
      challenge_win: ep.challenge_win ?? null,
      service_win: ep.service_win ?? null,
      ...Object.fromEntries(LIST_FIELDS.map((k) => [k, ep[k] ?? []])),
      winner: ep.winner ?? null,
      bonus: ep.bonus ?? {},
      notes: ep.notes ?? null,
      updated_at: new Date().toISOString(),
    });
  }
}

if (errors.length) {
  console.error("Results files have problems:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`${rows.length} episode files look good.`);
if (checkOnly) process.exit(0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (GitHub: Settings > Secrets and variables > Actions).");
  process.exit(1);
}

const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/episodes?on_conflict=season_id,num`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`Supabase rejected the update (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log(`Synced ${rows.length} episodes to Supabase.`);
