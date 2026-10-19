// Copies seasons, casts and episode results from data/<season>/ into Supabase.
// Run by the "Sync results" GitHub Action on every push that touches data/.
//   node scripts/sync-results.mjs --check   validate files only (no network)
//   node scripts/sync-results.mjs           validate, then upsert into Supabase
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment for the upsert.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SHOW_FIELDS, LIST_COLUMNS } from "./show-fields.mjs";

const DATA = new URL("../data/", import.meta.url).pathname;
const TEAM = new Set(["red", "blue", "both", null]);
const BASE_KEYS = new Set(["num", "title", "air_at", "posted", "bonus", "notes", "sources"]);
const checkOnly = process.argv.includes("--check");

const errors = [];
const seasons = []; // { season, seasonRow|null, castRows|null, episodeRows }

for (const season of readdirSync(DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const dir = join(DATA, season);
  const castFile = join(dir, "contestants.json");
  if (!existsSync(castFile)) {
    errors.push(`${season}: missing contestants.json`);
    continue;
  }
  const cast = JSON.parse(readFileSync(castFile, "utf8"));
  // Older seasons list the cast by team ({ red: { id: name } }); newer ones use { cast: { id: { name, age, hometown } } }.
  const ids = new Set([...Object.keys(cast.red ?? {}), ...Object.keys(cast.blue ?? {}), ...Object.keys(cast.cast ?? {})]);
  const showKey = cast.season?.show ?? "hells-kitchen";
  const fields = SHOW_FIELDS[showKey];
  if (!fields) {
    errors.push(`${season}: unknown show "${showKey}" (expected one of ${Object.keys(SHOW_FIELDS).join(", ")})`);
    continue;
  }

  // A "season" block means the sync manages the season row and cast too.
  let seasonRow = null;
  let castRows = null;
  if (cast.season) {
    if (!cast.season.title) errors.push(`${season}/contestants.json: "season.title" is required`);
    seasonRow = { id: season, show: fields.name, show_key: showKey, title: cast.season.title, network: cast.season.network ?? null, active: cast.season.active !== false };
    castRows = Object.entries(cast.cast ?? {}).map(([id, c]) => {
      if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${season}/contestants.json: id "${id}" should be lowercase letters, numbers or dashes`);
      if (!c?.name) errors.push(`${season}/contestants.json: "${id}" needs a name`);
      return { season_id: season, id, name: c?.name ?? id, team: null, age: c?.age ?? null, hometown: c?.hometown ?? null };
    });
  }

  const episodeRows = [];
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
    for (const k of Object.keys(ep)) {
      const known = BASE_KEYS.has(k) || k in fields.lists || fields.teamResults.includes(k) || (k === "winner" && fields.winnerColumn);
      if (!known) errors.push(`${where}: "${k}" isn't a field for this show`);
    }
    for (const k of fields.teamResults) {
      if (!TEAM.has(ep[k] ?? null)) errors.push(`${where}: "${k}" must be "red", "blue", "both" or null`);
    }
    const row = {
      season_id: season,
      num,
      title: ep.title ?? null,
      air_at: ep.air_at ? new Date(ep.air_at).toISOString() : null,
      posted: !!ep.posted,
      challenge_win: ep.challenge_win ?? null,
      service_win: ep.service_win ?? null,
      ...Object.fromEntries(LIST_COLUMNS.map((k) => [k, []])),
      winner: fields.winnerColumn ? ep.winner ?? null : null,
      bonus: ep.bonus ?? {},
      notes: ep.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const events = {};
    for (const [k, target] of Object.entries(fields.lists)) {
      const v = ep[k] ?? [];
      if (!Array.isArray(v)) {
        errors.push(`${where}: "${k}" must be a list`);
        continue;
      }
      for (const id of v) if (!ids.has(id)) errors.push(`${where}: unknown contestant id "${id}" in "${k}"`);
      const [kind, name] = target.split(":");
      if (kind === "column") row[name] = v;
      else if (v.length) events[name] = v;
    }
    // Only shows with their own events send the column, so Hell's Kitchen syncs the same as before.
    if (Object.values(fields.lists).some((t) => t.startsWith("event:"))) row.events = events;
    if (ep.winner && fields.winnerColumn && !ids.has(ep.winner)) errors.push(`${where}: unknown contestant id "${ep.winner}" in "winner"`);
    for (const id of Object.keys(ep.bonus ?? {})) if (!ids.has(id)) errors.push(`${where}: unknown contestant id "${id}" in "bonus"`);
    episodeRows.push(row);
  }
  seasons.push({ season, seasonRow, castRows, episodeRows });
}

if (errors.length) {
  console.error("Results files have problems:\n- " + errors.join("\n- "));
  process.exit(1);
}
const total = seasons.reduce((a, s) => a + s.episodeRows.length, 0);
console.log(`${total} episode files in ${seasons.length} seasons look good.`);
if (checkOnly) process.exit(0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (GitHub: Settings > Secrets and variables > Actions).");
  process.exit(1);
}

const base = url.replace(/\/$/, "");
const auth = {
  apikey: key,
  // Legacy service_role keys are JWTs and go in Authorization too.
  // Newer secret keys (sb_secret_...) are not JWTs and work from apikey alone.
  ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
};

async function upsert(table, conflict, rows) {
  if (!rows.length) return null;
  const res = await fetch(`${base}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  return res.ok ? null : `${table} (${res.status}): ${await res.text()}`;
}

// Episodes already posted in the database (for example, entered by hand on the admin page).
// A file that still says "posted": false never un-posts them; it's skipped with a warning.
const postedRes = await fetch(`${base}/rest/v1/episodes?select=season_id,num&posted=eq.true`, { headers: auth });
const alreadyPosted = new Set(postedRes.ok ? (await postedRes.json()).map((e) => `${e.season_id}/${e.num}`) : []);
if (!postedRes.ok) console.warn(`Couldn't read posted episodes (${postedRes.status}); syncing every file as written.`);
for (const s of seasons) {
  s.episodeRows = s.episodeRows.filter((r) => {
    if (r.posted || !alreadyPosted.has(`${s.season}/${r.num}`)) return true;
    console.warn(`Skipped ${s.season} episode ${r.num}: it's posted in the database but the file says "posted": false. Update the file to match.`);
    return false;
  });
}

// Each season syncs on its own, so a problem with one show doesn't hold up another.
const failures = [];
for (const s of seasons) {
  const err =
    (s.seasonRow && (await upsert("seasons", "id", [s.seasonRow]))) ||
    (s.castRows && (await upsert("contestants", "season_id,id", s.castRows))) ||
    (await upsert("episodes", "season_id,num", s.episodeRows));
  if (err) failures.push(`${s.season}: Supabase rejected ${err}`);
  else console.log(`Synced ${s.season}: ${s.episodeRows.length} episodes.`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
