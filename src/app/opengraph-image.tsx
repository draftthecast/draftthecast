import { ogCard, ogSize } from "@/lib/ogCard";

export const alt = "Draft the Cast: fantasy leagues for reality TV";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "Now playing: Hell's Kitchen and The Traitors",
    title: "Fantasy leagues for reality TV",
    subtitle: "Draft the cast, guess who's out, beat your friends. Free.",
  });
}
