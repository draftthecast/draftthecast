import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Draft the Cast", template: "%s | Draft the Cast" },
  description: "Fantasy leagues for reality TV. Draft the cast, guess who goes home, and beat your friends.",
  metadataBase: new URL("https://draftthecast.com"),
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
  if (user) {
    const [{ data: profile }, { data: adminRow }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("site_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    name = profile?.display_name ?? user.email ?? "";
    avatar = profile?.avatar_url ?? null;
    admin = !!adminRow;
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
        <div className="wrap">
          <header className="site">
            <Link href="/" className="wordmark">
              <span className="mark" aria-hidden="true" />
              Draft the Cast
            </Link>
            {user && (
              <nav aria-label="Account">
                {admin && (
                  <Link href="/admin" className="linkbtn">
                    Enter results
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
            <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
