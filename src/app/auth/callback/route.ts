import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends people back here after they sign in.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A 200 page that redirects itself, rather than a 302, so mobile WebKit
    // reliably keeps the session cookie set on this response.
    if (!error) return htmlRedirect(`${origin}${next}`);
    return htmlRedirect(`${origin}/?signin=failed&reason=${encodeURIComponent(error.message)}`);
  }
  return htmlRedirect(`${origin}/?signin=failed&reason=${encodeURIComponent(providerError ?? "No sign-in code came back from Google.")}`);
}

function htmlRedirect(url: string) {
  const attr = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const js = JSON.stringify(url).replace(/</g, "\\u003c");
  return new NextResponse(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${attr}"><script>location.replace(${js})</script>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
