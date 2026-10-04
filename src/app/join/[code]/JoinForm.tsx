"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinForm({ code }: { code: string }) {
  const router = useRouter();
  const [team, setTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!team.trim()) return setError("Give your team a name.");
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc("join_league", { p_code: code, p_team_name: team.trim() });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/league/${data}`);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h3>Name your team</h3>
      <input id="join-team" type="text" maxLength={40} placeholder="Raw Salmon Club" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team name" />
      {error && <span className="error">{error}</span>}
      <div>
        <button className="btn brand" disabled={busy}>
          {busy ? "Joining…" : "Join league"}
        </button>
      </div>
    </form>
  );
}
