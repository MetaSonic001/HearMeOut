import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HearMeOut",
    short_name: "HearMeOut",
    description: "Turn any PDF, notes or article into audio you can learn from.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f8fc",
    theme_color: "#4f46d6",
    categories: ["education", "productivity"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
