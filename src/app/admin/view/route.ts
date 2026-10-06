import { NextResponse } from "next/server";
import { VIEW_COOKIE } from "@/lib/viewMode";

// Switches a site admin between admin view and player view, then returns to the same page.
export async function POST(request: Request) {
  const form = await request.formData();
  const mode = form.get("mode") === "player" ? "player" : "admin";
  const back = String(form.get("back") ?? "/");
  const url = new URL(back.startsWith("/") && !back.startsWith("//") ? back : "/", request.url);
  const res = NextResponse.redirect(url, { status: 303 });
  if (mode === "player") res.cookies.set(VIEW_COOKIE, "player", { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  else res.cookies.delete(VIEW_COOKIE);
  return res;
}
