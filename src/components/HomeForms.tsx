"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateLeague({ seasons }: { seasons: { id: string; title: string }[] }) {
  const router = useRouter();
  const [season, setSeason] = useState(seasons[0]?.id ?? "");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !team.trim()) return setError("Fill in both names.");
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc("create_league", {
      p_season: season,
      p_name: name.trim(),
      p_team_name: team.trim(),
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/league/${data}`);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h3>Start a league</h3>
      {seasons.length > 1 && (
        <label className="field">
          Show
          <select id="create-season" value={season} onChange={(e) => setSeason(e.target.value)}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        League name
        <input id="create-name" type="text" maxLength={60} placeholder="The Group Chat League" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        Your team name
        <input id="create-team" type="text" maxLength={40} placeholder="Lamb Sauce Mafia" value={team} onChange={(e) => setTeam(e.target.value)} />
      </label>
      {error && <span className="error">{error}</span>}
      <div>
        <button className="btn brand" disabled={busy || !season}>
          {busy ? "Creating…" : "Create league"}
        </button>
      </div>
      <span className="soft small">You&apos;ll be the commissioner and get an invite link to share.</span>
    </form>
  );
}

export function JoinWithCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase().replace(/.*\/JOIN\//, "");
        if (c) router.push(`/join/${encodeURIComponent(c)}`);
      }}
    >
      <h3>Join with a code</h3>
      <label className="field">
        Invite code or link
        <input id="join-code" type="text" placeholder="K7Q2MX" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <div>
        <button className="btn ghost">Find league</button>
      </div>
    </form>
  );
}
