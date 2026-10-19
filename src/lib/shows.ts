// Each show's rules: what can happen in an episode, what it's called, and what it's worth.
// A season points at one of these through seasons.show_key. Adding a new season of an
// existing show needs no code; adding a new show means adding an entry here.

/** Result fields that have their own database column. Anything else lives in episodes.events. */
export const COLUMN_EVENTS = ["mvp", "nominated", "ejected", "eliminated", "quit", "switched", "black_jacket", "final2"] as const;

export interface EventDef {
  key: string;
  /** Column header in the results editor. */
  label: string;
  /** How it reads in a chef's scoring history, e.g. "Sent home". */
  scored: string;
  /** How it reads in the scoring table on How to play. */
  rule: string;
  pts: number;
  /** The contestant leaves the game. */
  out?: boolean;
  group: "episode" | "out" | "end";
}

export interface TeamResultDef {
  key: "challenge_win" | "service_win";
  label: string;
  scored: string;
  rule: string;
  pts: number;
}

export interface ShowDef {
  key: string;
  slug: string;
  name: string;
  /** One line for show cards. */
  blurb: string;
  noun: { one: string; many: string };
  teamPlaceholder: string;
  /** Red and blue teams. */
  teams: boolean;
  teamResults: TeamResultDef[];
  events: EventDef[];
  survive: number;
  /** Extra points when a nominated contestant survives (Hell's Kitchen). */
  survivedBlock?: { pts: number; rule: string };
  /** Several winners can share the title. Stored as the "winners" event instead of the winner column. */
  multiWinner: boolean;
  winnerPts: number;
  guessPts: number;
  winnerPickPts: number;
  outWord: string; // "Sent home", "Out"
  guessQuestion: (n: number) => string;
  guessRule: string;
  scoringNote: string;
  steps: [string, string][];
}

const HK: ShowDef = {
  key: "hells-kitchen",
  slug: "hells-kitchen",
  name: "Hell's Kitchen",
  blurb: "Draft chefs, score team wins and black jackets, and guess who Chef Ramsay sends home.",
  noun: { one: "chef", many: "chefs" },
  teamPlaceholder: "Lamb Sauce Mafia",
  teams: true,
  teamResults: [
    { key: "challenge_win", label: "Challenge won by", scored: "Team won the challenge", rule: "Their team wins the challenge", pts: 2 },
    { key: "service_win", label: "Dinner service won by", scored: "Team won dinner service", rule: "Their team wins dinner service", pts: 2 },
  ],
  events: [
    { key: "nominated", label: "Up for elimination", scored: "Up for elimination", rule: "Put up for elimination", pts: -2, group: "out" },
    { key: "ejected", label: "Kicked out", scored: "Kicked out of service", rule: "Kicked out of dinner service", pts: -3, group: "out" },
    { key: "eliminated", label: "Sent home", scored: "Sent home", rule: "Sent home", pts: -3, out: true, group: "out" },
    { key: "quit", label: "Quit or medical", scored: "Left the competition", rule: "Quits or leaves for medical reasons", pts: -5, out: true, group: "out" },
    { key: "switched", label: "Switched team", scored: "Switched teams", rule: "Switches teams", pts: 1, group: "out" },
    { key: "black_jacket", label: "Black jacket", scored: "Earned a black jacket", rule: "Earns a black jacket", pts: 10, group: "end" },
    { key: "final2", label: "Final 2", scored: "Made the final 2", rule: "Makes the final 2", pts: 10, group: "end" },
  ],
  survive: 2,
  survivedBlock: { pts: 3, rule: "Survives elimination" },
  multiWinner: false,
  winnerPts: 25,
  guessPts: 5,
  winnerPickPts: 15,
  outWord: "Sent home",
  guessQuestion: (n) => `Who goes home in episode ${n}?`,
  guessRule: "Before each episode, guess who Chef Ramsay sends home. If two chefs go home, either one counts.",
  scoringNote: "Being up for elimination costs 2 points, but surviving it pays 3, so a chef who keeps escaping still helps you.",
  steps: [
    ["Draft your chefs", "Take turns picking contestants until every team is full."],
    ["Score every episode", "Your chefs earn points for wins, surviving elimination and black jackets. Most points at the finale wins."],
  ],
};

const TRAITORS: ShowDef = {
  key: "traitors",
  slug: "traitors",
  name: "The Traitors",
  blurb: "Draft players, score shields and survival, cash in when your pick turns Traitor, and guess who's out next.",
  noun: { one: "player", many: "players" },
  teamPlaceholder: "Cloak and Dagger",
  teams: false,
  teamResults: [],
  events: [
    { key: "traitor", label: "Became a Traitor", scored: "Became a Traitor", rule: "Chosen or recruited as a Traitor", pts: 5, group: "episode" },
    { key: "shield", label: "Shield", scored: "Won a shield", rule: "Wins a shield", pts: 3, group: "episode" },
    { key: "mvp", label: "Mission standout", scored: "Mission standout", rule: "Mission standout (wins it, earns the most, or is singled out)", pts: 3, group: "episode" },
    { key: "close_call", label: "Close call", scored: "Survived a close vote", rule: "Has the second-most banishment votes and survives", pts: 2, group: "episode" },
    { key: "murdered", label: "Murdered", scored: "Murdered", rule: "Murdered by the Traitors", pts: -2, out: true, group: "out" },
    { key: "eliminated", label: "Banished", scored: "Banished", rule: "Banished at the Round Table", pts: -4, out: true, group: "out" },
    { key: "quit", label: "Left", scored: "Left the game", rule: "Leaves the game on their own or for medical reasons", pts: -5, out: true, group: "out" },
    { key: "final2", label: "Finalist", scored: "Made the final", rule: "Makes the final Round Table", pts: 10, group: "end" },
    { key: "winners", label: "Won", scored: "Won the game", rule: "Wins (or splits) the prize", pts: 25, group: "end" },
  ],
  survive: 2,
  multiWinner: true,
  winnerPts: 25,
  guessPts: 5,
  winnerPickPts: 15,
  outWord: "Out",
  guessQuestion: (n) => `Who's out in episode ${n}?`,
  guessRule: "Before each episode, guess one player who leaves: murdered or banished both count.",
  scoringNote: "Murders are scored in the episode where the victim is revealed. Being murdered costs less than being banished, because the Traitors only kill players they fear.",
  steps: [
    ["Draft your players", "Take turns picking players until every team is full. Nobody knows who the Traitors are yet."],
    ["Score every episode", "Your players earn points for surviving, shields and turning Traitor. Most points at the finale wins."],
  ],
};

export const SHOWS: ShowDef[] = [HK, TRAITORS];

export function showByKey(key: string | null | undefined): ShowDef {
  return SHOWS.find((s) => s.key === key) ?? HK;
}

export function showBySlug(slug: string): ShowDef | null {
  return SHOWS.find((s) => s.slug === slug) ?? null;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ScoringGroup {
  title: string;
  rows: [string, number][];
}

export function scoringGroups(show: ShowDef): ScoringGroup[] {
  const ev = (g: "episode" | "end") => show.events.filter((e) => e.group === g && e.key !== "winners").map((e): [string, number] => [e.rule, e.pts]);
  return [
    { title: "Each episode", rows: [["Stays in the game", show.survive], ...show.teamResults.map((t): [string, number] => [t.rule, t.pts]), ...ev("episode")] },
    {
      title: show.teams ? "Elimination" : "Leaving the game",
      rows: show.events
        .filter((e) => e.group === "out")
        .flatMap((e): [string, number][] =>
          e.key === "nominated" && show.survivedBlock ? [[e.rule, e.pts], [show.survivedBlock.rule, show.survivedBlock.pts]] : [[e.rule, e.pts]],
        ),
    },
    { title: "End of the season", rows: [...ev("end"), ["Wins the season", show.winnerPts]] },
    { title: "Your guesses", rows: [["Correctly guess who's out", show.guessPts], ["Correctly guess the season winner", show.winnerPickPts]] },
  ];
}
