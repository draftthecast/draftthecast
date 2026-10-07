import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";
import { adminViewOn } from "@/lib/viewMode";
import ViewToggle from "@/components/ViewToggle";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  applicationName: SITE.name,
  keywords: ["fantasy reality TV", "Hell's Kitchen fantasy league", "Hell's Kitchen Season 25", "reality TV draft", "fantasy league with friends"],
  openGraph: { type: "website", siteName: SITE.name, url: SITE.url, title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description, locale: "en_US" },
  twitter: { card: "summary_large_image", title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description },
};

// Tells search engines and AI tools what the site is.
const siteLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE.url}/#website`, name: SITE.name, url: SITE.url, description: SITE.description },
    {
      "@type": "WebApplication",
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      description: SITE.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      isAccessibleForFree: true,
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#14162a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  let name = "";
  let avatar: string | null = null;
  let admin = false;
  let adminView = false;
  if (user) {
    const [{ data: profile }, { data: adminRow }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("site_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    name = profile?.display_name ?? user.email ?? "";
    avatar = profile?.avatar_url ?? null;
    admin = !!adminRow;
    adminView = await adminViewOn(admin);
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd).replace(/</g, "\\u003c") }} />
        <div className="wrap">
          <header className="site">
            <Link href="/" className="wordmark">
              <span className="mark" aria-hidden="true" />
              Draft the Cast
            </Link>
            {user && (
              <nav aria-label="Account">
                {admin && <ViewToggle adminView={adminView} />}
                {adminView && (
                  <Link href="/admin" className="linkbtn">
                    Admin
                  </Link>
                )}
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="avatar" referrerPolicy="no-referrer" />
                ) : null}
                <span className="small soft">{name.split(" ")[0]}</span>
                <form action="/auth/signout" method="post">
                  <button className="linkbtn" type="submit">
                    Sign out
                  </button>
                </form>
              </nav>
            )}
          </header>
          {children}
          <footer>
            A fan-made fantasy game. Not affiliated with FOX, Hell&apos;s Kitchen or any network.{" "}
            <Link href="/how-to-play">How to play</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
