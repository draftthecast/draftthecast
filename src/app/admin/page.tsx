import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import AdminResults from "./AdminResults";

export const metadata: Metadata = { title: "Enter results" };

export default async function AdminPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/");
  const { data: admin } = await supabase.from("site_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) {
    return (
      <main className="empty">
        <b>This page is for site admins</b>
        <span>Results are entered by the site admin, and every league updates from them.</span>
      </main>
    );
  }
  const [{ data: seasons }, { data: leagues }] = await Promise.all([
    supabase.from("seasons").select("id, title").order("created_at"),
    supabase.from("leagues").select("id, name, draft_status, league_members(count)").order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <AdminResults seasons={seasons ?? []} />
      <section className="section">
        <h2>All leagues</h2>
        <p className="soft small">Only you see this list, because you&apos;re the site admin. Other people only see leagues they&apos;ve joined.</p>
        <div className="table list calls">
          {(leagues ?? []).map((l) => (
            <div key={l.id} className="it">
              <Link href={`/league/${l.id}`}><b>{l.name}</b></Link>
              <span className="soft small">
                {(l.league_members as unknown as { count: number }[])?.[0]?.count ?? 0} teams,{" "}
                {l.draft_status === "setup" ? "draft not open" : l.draft_status === "open" ? "drafting" : "season underway"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
