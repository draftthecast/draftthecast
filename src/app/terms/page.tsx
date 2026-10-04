import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <main className="prose-page">
      <h1>Terms</h1>
      <p className="soft">Last updated October 4, 2026</p>
      <ul>
        <li>Draft the Cast is a free game played for fun. There are no entry fees or prizes run through the site.</li>
        <li>It&apos;s a fan project and isn&apos;t affiliated with, sponsored by or endorsed by FOX, Hell&apos;s Kitchen or any network or production company. Show names are used only to describe what each league is about.</li>
        <li>Results are entered by hand after each episode airs and may occasionally be corrected.</li>
        <li>Keep team names friendly. We may remove content or accounts that are abusive.</li>
        <li>The site is provided as is, and we may change or end it at any time.</li>
      </ul>
      <p>Questions: draftthecast@gmail.com</p>
    </main>
  );
}
