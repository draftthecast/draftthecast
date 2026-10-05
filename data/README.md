# Episode results

Each file here is one episode's results. When a file is added or changed on `main`, the **Sync results** GitHub Action copies every file into Supabase, and every league's standings update within seconds.

A scheduled Claude task writes these files automatically the day after each episode airs. You can also edit a file on GitHub by hand to fix a mistake. These files are the source of truth: a result edited on the site's "Enter results" page gets overwritten the next time the files sync.

## File format: `data/<season>/ep-NN.json`

```json
{
  "num": 3,
  "title": "Episode title, or null",
  "air_at": "2026-10-08T20:00:00-04:00",
  "posted": true,
  "challenge_win": "red | blue | both | null",
  "service_win": "red | blue | both | null",
  "mvp": [],
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
| `mvp` | Standouts: top-scoring dish(es), individual challenge winners, punishment-pass winners, or a chef Ramsay singles out as best of the night. Usually 1 to 3 chefs; more only when the episode clearly highlights more. |
| `nominated` | Chefs put up for elimination (nominated by their team or by Ramsay). |
| `ejected` | Chefs Ramsay kicked out of dinner service. |
| `eliminated` | Chefs Ramsay sent home, including anyone eliminated without nomination or during service. |
| `quit` | Chefs who left on their own or for medical reasons. Don't also list them in `eliminated`. |
| `switched` | Chefs Ramsay moved to the other team. |
| `black_jacket` | Chefs who received black jackets in this episode (only the episode they earned it). |
| `final2` | The two finalists, in the episode where the final two are named. |
| `winner` | The season winner's id, only in the finale. |
| `bonus` | Leave `{}`. For the commissioner's one-off awards, e.g. `{"mya": 5}`. |

## Rules for automatic entry

- Only write an episode after it has aired and at least one detailed recap exists.
- Confirm who went home with **two independent sources**. If sources disagree or only one exists, write the file with `"posted": false` so it doesn't count yet, and say so in `notes`.
- Leave a team field `null` rather than guess.
- Add next episode's air time if a schedule source lists it: add or update `ep-NN.json` for the upcoming episode with `"posted": false` and empty results.
- New chefs never appear mid-season in Hell's Kitchen. If a recap names someone not in `contestants.json`, it's a nickname (e.g. "Serenity" is `reni`, "Jonny G" is `jonny`) or a mistake; don't invent ids.
