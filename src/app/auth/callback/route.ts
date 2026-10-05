import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends people back here after they sign in.
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const nextParam = searchParams.get("next") ?? "/";
    const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // Redirecting straight from this response can drop the just-set session
      // cookie on WebKit (iOS Safari/Chrome/Firefox all use it). Returning a
      // 200 page that redirects itself keeps the cookie-setting response and
      // the navigation separate, which WebKit handles reliably.
      if (!error) return htmlRedirect(`${origin}${next}`);
  }
    return htmlRedirect(`${origin}/?signin=failed`);
}

function htmlRedirect(url: string) {
    return new NextResponse(
          `<!doctype html><meta http-equiv="refresh" content="0;url=${url}"><script>location.replace(${JSON.stringify(url)})</script>`,
      { headers: { "content-type": "text/html" } },
        );
}
