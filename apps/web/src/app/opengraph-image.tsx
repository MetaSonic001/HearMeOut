import { ImageResponse } from "next/og"

export const alt = "HearMeOut: listen to anything, learn faster"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  const bars = [90, 190, 300, 180, 100]
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #1e1b4b 0%, #4f46d6 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 64 }}>
            {[24, 44, 60, 40].map((h, i) => (
              <div key={i} style={{ width: 12, height: h, borderRadius: 6, background: "white" }} />
            ))}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>HearMeOut</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Listen to anything.</div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: "#c7d2fe" }}>Learn faster.</div>
          <div style={{ fontSize: 32, color: "#e0e7ff", marginTop: 8 }}>PDFs and notes to audio in English, Hindi, Hinglish and more</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 100, opacity: 0.35 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ width: 14, height: bars[i % bars.length] / 3 + 8, borderRadius: 7, background: "white" }} />
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
