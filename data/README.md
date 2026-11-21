# Episode results

Each folder is one season (`hk25` is Hell's Kitchen Season 25, `traitors-nb` is The Traitors: New Blood). Each file in it is one episode's results. When a file is added or changed on `main`, the **Sync results** GitHub Action copies every file into Supabase, and every league's standings update within seconds.

A scheduled Claude task writes these files automatically the day after each episode airs. You can also edit a file on GitHub by hand to fix a mistake. These files are the source of truth: a result edited on the site's "Enter results" page gets overwritten the next time the files sync.

## Hell's Kitchen file format: `data/hk25/ep-NN.json`

```json
{
  "num": 3,
  "title": "Episode title, or null",
  "air_at": "2026-10-08T20:00:00-04:00",
  "posted": true,
  "challenge_win": "red | blue | both | null",
  "service_win": "red | blue | both | null",
  "nominated": [],
  "ejected": [],
  "eliminated": [],
  "quit": [],
  "switched": [],
  "black_jacket": [],
  "final2": [],
  "winner": null,
  "bonus": {},
  "notes": "One or two plain sentences summarizing the episode for the league.",
  "sources": ["https://recap-article-1", "https://recap-article-2"]
}
```

Use the chef ids from `contestants.json` (for example `"mya"`, not `"Mya Gonsalves"`). The sync refuses unknown ids, so a typo fails loudly instead of scoring the wrong chef.

## What each field means

| Field | Fill it with |
| --- | --- |
| `challenge_win` | The team that won the main team challenge. If several challenges are mixed, the team challenge that decided the reward/punishment. `null` when there was no team challenge or it's unclear. |
| `service_win` | The team that won dinner service. `"both"` if Ramsay declared both teams winners; `null` if there was no service, both lost, or it's unclear. |
| `nominated` | Chefs put up for elimination (nominated by their team or by Ramsay). |
| `ejected` | Chefs Ramsay kicked out of dinner service. |
| `eliminated` | Chefs Ramsay sent home, including anyone eliminated without nomination or during service. |
| `quit` | Chefs who left on their own or for medical reasons. Don't also list them in `eliminated`. |
| `switched` | Chefs Ramsay moved to the other team. |
| `black_jacket` | Chefs who received black jackets in this episode (only the episode they earned it). |
| `final2` | The two finalists, in the episode where the final two are named. |
| `winner` | The season winner's id, only in the finale. |
| `bonus` | Leave `{}`. For the commissioner's one-off awards, e.g. `{"mya": 5}`. |

## The Traitors file format: `data/traitors-nb/ep-NN.json`

```json
{
  "num": 6,
  "title": "Episode title, or null",
  "air_at": "2026-10-15T20:00:00-04:00",
  "posted": true,
  "traitor": [],
  "shield": [],
  "mvp": [],
  "close_call": [],
  "murdered": [],
  "banished": [],
  "quit": [],
  "finalists": [],
  "winners": [],
  "bonus": {},
  "notes": "One or two plain sentences summarizing the episode for the league.",
  "sources": ["https://recap-article-1", "https://recap-article-2"]
}
```

| Field | Fill it with |
| --- | --- |
| `traitor` | Players who became Traitors in this episode: the initial picks, or anyone recruited or seduced later. Only the episode it happens. |
| `shield` | Players who won a shield. |
| `mvp` | Mission standouts: a player who wins the mission for the group, earns the most money, or is clearly singled out. Usually empty or 1 to 2. |
| `close_call` | The player(s) with the second-most banishment votes who survived (a tie for second lists both). Leave empty if the vote count isn't reported by two sources. |
| `murdered` | Players murdered by the Traitors, in the episode where the victim is **revealed** (usually at breakfast). Include anyone eliminated by a Traitor twist outside the Round Table. |
| `banished` | Players banished at the Round Table, whether Faithful or Traitor. |
| `quit` | Players who left on their own or for medical reasons. |
| `finalists` | Everyone at the final Round Table, in the finale. |
| `winners` | Everyone who wins or splits the prize, in the finale. |

A Traitors episode often has both a murder and a banishment, and with two-episode nights recaps cover both: split events by episode number.

## Starting a new season

Add a folder named for the season (e.g. `traitors-us6`) with a `contestants.json` like this, then the episode files. The sync creates the season and its cast; no code changes are needed for a new season of a show the site already supports.

```json
{
  "season": { "show": "traitors", "title": "The Traitors, Season 6", "network": "Peacock", "active": true },
  "cast": { "alan": { "name": "Full Name", "age": 30, "hometown": "City, ST" } }
}
```

`show` is `"hells-kitchen"` or `"traitors"`. Set `"active": false` once a season is over and new leagues shouldn't pick it.

## Rules for automatic entry

- Only write an episode after it has aired.
- **Post as soon as one credible source names who went home** (sent home, murdered or banished): a detailed recap, a short "who went home" article, or a news headline that names them. Don't hold an episode waiting for a second source.
- Hold (`"posted": false`) only when no credible source names who went home yet, or when two credible sources disagree. Say why in `notes`.
- The same recap is enough for the rest of the episode (challenge, service, standouts, nominations). Leave a field empty or `null` when the source doesn't say; don't guess.
- If a later source shows a posted result was wrong, correct the file and say so in the commit message.
- Add next episode's air time if a schedule source lists it: add or update `ep-NN.json` for the upcoming episode with `"posted": false` and empty results.
- New chefs never appear mid-season in Hell's Kitchen. If a recap names someone not in `contestants.json`, it's a nickname (e.g. "Serenity" is `reni`, "Jonny G" is `jonny`) or a mistake; don't invent ids.

### Finding a source

Search engines differ: the one the scheduled task uses often misses pages that Google shows. So search many ways before giving up: "<show> season N episode N recap", "<show> who went home episode N", "<show> eliminated" plus the date, "two chefs eliminated", the episode title, and each remaining contestant's name with "eliminated".

Where results usually show up first:

- **Local news.** Hell's Kitchen Season 25 is filmed at Foxwoods in Connecticut, and **CT Insider** (ctinsider.com, also New Haven Register, CT Post, Greenwich Time) recaps each episode the night it airs, e.g. "Two chefs eliminated for first time this season on Connecticut-filmed 'Hell's Kitchen'".
- **Entertainment outlets:** Gold Derby, Primetimer, TV Insider, Soap Central, Reality Blurred, Moviedelic, entertainmentNow, Parade, Screen Rant, Dexerto, TVLine, Decider, Vulture, AV Club, Entertainment Weekly, Cinemablend, Meaww, TellTale TV, DirecTV Insider, Sportskeeda, the network's own site (FOX, NBC Insider). Yahoo, MSN and AOL usually republish one of these.
- **Fan pages**, as a check only: the Hell's Kitchen Wiki (hellskitchen.fandom.com), r/HellsKitchen or r/TheTraitors discussion threads, and YouTube recap titles. Use them to confirm or fill in details, but don't post on a fan page alone.

What doesn't count: a page plainly about a different episode or season (check the episode number and the challenge), a network synopsis written before airing, or an AI-generated summary with no article behind it.

If a page won't load, try another outlet instead of giving up: many sites block automated reading, and the same news is usually on several of them.
