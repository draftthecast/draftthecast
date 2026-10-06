export type Team = "red" | "blue";
export type TeamResult = "red" | "blue" | "both" | null;

export interface Contestant {
  season_id: string;
  id: string;
  name: string;
  team: Team;
  age: number | null;
  hometown: string | null;
}

export interface Episode {
  season_id: string;
  num: number;
  title: string | null;
  air_at: string | null;
  posted: boolean;
  challenge_win: TeamResult;
  service_win: TeamResult;
  mvp: string[];
  nominated: string[];
  ejected: string[];
  eliminated: string[];
  quit: string[];
  switched: string[];
  black_jacket: string[];
  final2: string[];
  winner: string | null;
  bonus: Record<string, number>;
  notes: string | null;
  /** Set when these results come from the league's own entry rather than the site-wide results. */
  fromLeague?: boolean;
}

export interface Season {
  id: string;
  show: string;
  title: string;
  network: string | null;
}

export interface League {
  id: string;
  season_id: string;
  name: string;
  invite_code: string;
  created_by: string;
  mode: "snake" | "open";
  roster_size: number;
  start_episode: number;
  draft_status: "setup" | "open" | "closed";
  draft_order: string[];
}

export interface Member {
  id: string;
  league_id: string;
  user_id: string | null;
  team_name: string;
  manager_name: string | null;
  role: "commissioner" | "player";
  winner_pick: string | null;
  joined_at: string;
}

export interface Pick {
  id: string;
  league_id: string;
  member_id: string;
  contestant_id: string;
  pick_no: number;
}

export interface Guess {
  league_id: string;
  member_id: string;
  episode_num: number;
  contestant_id: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export type FlagKey = "mvp" | "nominated" | "ejected" | "eliminated" | "quit" | "switched" | "black_jacket" | "final2";

/** A league commissioner's own results for one episode. Takes priority over the site-wide episode results. */
export interface LeagueResult extends Omit<Episode, "season_id" | "title" | "air_at"> {
  league_id: string;
  updated_by: string | null;
  updated_at: string;
}
