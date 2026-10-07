import { SITE } from "@/lib/site";
import { SCORING_GROUPS } from "@/components/ScoringTable";

// A plain-text summary of the site for AI assistants (the llms.txt convention).
export const dynamic = "force-static";

export function GET() {
  const scoring = SCORING_GROUPS.map(
    (g) => `### ${g.title}\n` + g.rows.map(([t, p]) => `- ${t}: ${p > 0 ? "+" : ""}${p}`).join("\n"),
  ).join("\n\n");
  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is a free, fan-made fantasy game. It is not affiliated with FOX, Hell's Kitchen or any network.

## Shows
${SITE.shows.map((s) => `- ${s}`).join("\n")}

## How it works
1. Sign in with Google, then start a league or open a friend's invite link.
2. Draft contestants. In a take-turns (snake) draft each contestant goes to one team and the order reverses every round; in a free-pick league contestants can be on several teams.
3. After each episode airs, results are added and every team's points update.
4. Before each episode, guess who goes home for bonus points. Guesses lock when the episode starts.

## Scoring (Hell's Kitchen)
${scoring}

## Pages
- [Home](${SITE.url}/): start or join a league
- [How to play](${SITE.url}/how-to-play): rules, scoring and FAQ
- [Privacy](${SITE.url}/privacy)
- [Terms](${SITE.url}/terms)

Leagues are private to their members, so league pages, standings and invites aren't publicly readable.

Contact: ${SITE.email}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
