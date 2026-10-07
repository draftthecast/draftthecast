import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Public pages can be indexed; leagues, admin and sign-in stay out of search results.
// Invite pages stay crawlable so chat apps can build link previews, and carry a noindex tag instead.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/league/", "/admin", "/auth/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
