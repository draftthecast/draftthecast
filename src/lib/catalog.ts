import type { SupabaseClient } from "@supabase/supabase-js";
import { SHOWS, showByKey, type ShowDef } from "./shows";

export interface SeasonInfo {
  id: string;
  title: string;
  network: string | null;
  status: "airing" | "upcoming" | "finished";
  /** Next episode's air time, if it's on the schedule. */
  nextAir: string | null;
  firstAir: string | null;
}

export interface ShowInfo {
  show: ShowDef;
  seasons: SeasonInfo[];
  /** The season to start a league for: airing first, then upcoming. */
  current: SeasonInfo | null;
}

/** Every show with at least one active season, airing shows first. Works before the show_key column exists. */
export async function getCatalog(supabase: SupabaseClient): Promise<ShowInfo[]> {
  const { data: seasons } = await supabase.from("seasons").select("*").eq("active", true).order("created_at");
  const ids = (seasons ?? []).map((s) => s.id as string);
  const { data: eps } = ids.length
    ? await supabase.from("episodes").select("season_id, num, air_at, posted").in("season_id", ids)
    : { data: [] as { season_id: string; num: number; air_at: string | null; posted: boolean }[] };
  const now = Date.now();
  const info = (s: { id: string; title: string; network: string | null }): SeasonInfo => {
    const list = (eps ?? []).filter((e) => e.season_id === s.id).sort((a, b) => a.num - b.num);
    const aired = list.filter((e) => e.posted || (e.air_at && new Date(e.air_at).getTime() <= now));
    const next = list.find((e) => !e.posted && (!e.air_at || new Date(e.air_at).getTime() > now));
    const status = !aired.length ? "upcoming" : list.length && list.every((e) => e.posted) ? "finished" : "airing";
    return { id: s.id, title: s.title, network: s.network, status, nextAir: next?.air_at ?? null, firstAir: list[0]?.air_at ?? null };
  };
  const rank = { airing: 0, upcoming: 1, finished: 2 } as const;
  return SHOWS.map((show) => {
    const list = (seasons ?? []).filter((s) => showByKey(s.show_key).key === show.key).map(info);
    const current = [...list].sort((a, b) => rank[a.status] - rank[b.status])[0] ?? null;
    return { show, seasons: list, current };
  })
    .filter((x) => x.seasons.length)
    .sort((a, b) => rank[a.current?.status ?? "finished"] - rank[b.current?.status ?? "finished"]);
}

export function statusLine(s: SeasonInfo | null): string {
  if (!s) return "";
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
  if (s.status === "airing") return s.nextAir ? `Airing now · next episode ${day(s.nextAir)}` : "Airing now";
  if (s.status === "upcoming") return s.firstAir ? `Premieres ${day(s.firstAir)}` : "Coming soon";
  return "Season finished";
}
