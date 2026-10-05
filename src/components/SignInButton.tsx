"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignInButton({ next = "/", label = "Continue with Google" }: { next?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  // Google blocks sign-in inside apps' built-in browsers (Instagram, Facebook, TikTok and others).
  useEffect(() => {
    const ua = navigator.userAgent;
    setInApp(/Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|LinkedInApp|Snapchat|musical_ly|TikTok|BytedanceWebview|Twitter|; wv\)/i.test(ua));
  }, []);

  async function signIn() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError("Google sign-in didn't start. Try again in a moment.");
      setBusy(false);
    }
  }

  if (inApp) {
    return (
      <div className="note sun" style={{ flexDirection: "column", alignItems: "flex-start" }}>
        <span>
          <b>Open this page in Safari or Chrome to sign in.</b> Google doesn&apos;t allow sign-in inside this app&apos;s built-in browser. Tap the
          menu (••• or ⋮) and choose &quot;Open in browser,&quot; or copy the link.
        </span>
        <button
          className="btn small"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    );
  }

  return (
    <div className="section" style={{ gap: 6 }}>
      <div>
        <button className="google" onClick={signIn} disabled={busy} type="button">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy ? "Opening Google…" : label}
        </button>
      </div>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
