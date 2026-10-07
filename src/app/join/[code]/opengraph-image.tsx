import { ogCard, ogSize } from "@/lib/ogCard";
import { createClient } from "@/lib/supabase/server";

export const alt = "You're invited to a Draft the Cast league";
export const size = ogSize;
export const contentType = "image/png";

// Invite links preview as "Join <league name>" in group chats.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("league_preview", { p_code: code });
  const league = (data as { name: string; season_title: string }[] | null)?.[0];
  return ogCard({
    kicker: "You're invited",
    title: league ? `Join ${league.name}` : "Join a fantasy league",
    subtitle: league ? `${league.season_title} fantasy league on Draft the Cast` : "Draft the cast, guess who goes home, beat your friends.",
  });
}
