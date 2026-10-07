import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

// The link-preview card shown when a draftthecast.com link is shared in texts and social apps.
export function ogCard({ title, subtitle, kicker }: { title: string; subtitle: string; kicker?: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#5b3df5", padding: "64px 72px", color: "#ffffff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#ffffff", display: "flex", position: "relative" }}>
            <div style={{ position: "absolute", left: 15, top: 15, width: 14, height: 34, borderRadius: 6, background: "#5b3df5" }} />
            <div style={{ position: "absolute", left: 35, top: 15, width: 15, height: 15, borderRadius: 8, background: "#ffd84d" }} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>Draft the Cast</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {kicker ? <div style={{ fontSize: 30, color: "#ffd84d", fontWeight: 700 }}>{kicker}</div> : null}
          <div style={{ fontSize: title.length > 34 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>{subtitle}</div>
        </div>
      </div>
    ),
    ogSize,
  );
}
