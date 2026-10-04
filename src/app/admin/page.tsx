import type { Metadata } from "next";
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
  const { data: seasons } = await supabase.from("seasons").select("id, title").order("created_at");
  return <AdminResults seasons={seasons ?? []} />;
}
