"use client";

import { usePathname } from "next/navigation";

// Small toggle in the header, shown only to site admins.
export default function ViewToggle({ adminView }: { adminView: boolean }) {
  const path = usePathname();
  return (
    <form action="/admin/view" method="post" className="viewtoggle">
      <input type="hidden" name="mode" value={adminView ? "player" : "admin"} />
      <input type="hidden" name="back" value={path} />
      <button type="submit" className={`chip ${adminView ? "win" : "plain"}`} title="Only you can see this switch">
        {adminView ? "Admin view" : "Player view"}
        <span className="p">{adminView ? "switch to player" : "switch to admin"}</span>
      </button>
    </form>
  );
}
