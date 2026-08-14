import { ImageResponse } from "next/og";

export const alt = "Roamline — Every journey has a story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 78px", background: "#111210", color: "#f7f7f3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ width: 64, height: 58, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, transform: "rotate(-22deg)" }}>
          <div style={{ width: 38, height: 10, borderRadius: 20, background: "#f7f7f3" }} />
          <div style={{ width: 54, height: 10, borderRadius: 20, background: "#f7f7f3", marginLeft: 6 }} />
          <div style={{ width: 34, height: 10, borderRadius: 20, background: "#f7f7f3", marginLeft: 22 }} />
        </div>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, letterSpacing: -2 }}>Roamline</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", color: "#ff6754", fontSize: 20, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 26 }}>Trips, shared simply</div>
        <div style={{ display: "flex", maxWidth: 950, fontSize: 82, lineHeight: 1.02, fontWeight: 600, letterSpacing: -5 }}>Every journey has a story.</div>
        <div style={{ display: "flex", marginTop: 24, color: "#aaa9a2", fontSize: 28 }}>Keep yours together.</div>
      </div>
    </div>,
    size,
  );
}
