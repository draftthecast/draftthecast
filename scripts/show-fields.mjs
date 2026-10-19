// How each show's episode-file fields map onto the database.
// "column:<name>" is an episodes column; "event:<key>" goes into episodes.events.
// Keep in step with src/lib/shows.ts (scripts/show-fields.test.mjs checks this).

export const SHOW_FIELDS = {
  "hells-kitchen": {
    name: "Hell's Kitchen",
    teamResults: ["challenge_win", "service_win"],
    winnerColumn: true,
    lists: {
      nominated: "column:nominated",
      ejected: "column:ejected",
      eliminated: "column:eliminated",
      quit: "column:quit",
      switched: "column:switched",
      black_jacket: "column:black_jacket",
      final2: "column:final2",
    },
  },
  traitors: {
    name: "The Traitors",
    teamResults: [],
    winnerColumn: false,
    lists: {
      traitor: "event:traitor",
      shield: "event:shield",
      mvp: "column:mvp",
      close_call: "event:close_call",
      murdered: "event:murdered",
      banished: "column:eliminated",
      quit: "column:quit",
      finalists: "column:final2",
      winners: "event:winners",
    },
  },
};

export const LIST_COLUMNS = ["mvp", "nominated", "ejected", "eliminated", "quit", "switched", "black_jacket", "final2"];
