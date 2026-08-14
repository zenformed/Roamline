import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Roamline", short_name: "Roamline", description: "Share trips, moments, and the road between them.", start_url: "/", display: "standalone", background_color: "#f7f7f3", theme_color: "#171817", orientation: "portrait-primary", icons: [{ src: "/roamline-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: "/roamline-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}
