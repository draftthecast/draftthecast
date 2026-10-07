import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <main className="prose-page">
      <h1>Privacy</h1>
      <p className="soft">Last updated October 4, 2026</p>
      <p>Draft the Cast is a free fantasy game for reality TV fans. This page explains what we collect and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>When you sign in with Google, we receive your name, email address and profile photo. We use them to show who is in each league and to keep you signed in.</li>
        <li>The leagues you create or join, your team name, your draft picks and your weekly guesses.</li>
      </ul>
      <h2>How it&apos;s used</h2>
      <ul>
        <li>Other members of your league can see your name, photo, team name, picks and guesses. Weekly guesses stay hidden until the episode starts.</li>
        <li>We don&apos;t sell your information, show you ads, or share it with anyone outside the services that run the site.</li>
      </ul>
      <h2>Services we use</h2>
      <ul>
        <li>Google, to sign you in.</li>
        <li>Supabase, which stores the league data.</li>
        <li>Vercel, which hosts the site.</li>
      </ul>
      <h2>Deleting your data</h2>
      <p>Email draftthecast@gmail.com and we&apos;ll delete your account and everything tied to it.</p>
    </main>
  );
}
