import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Roamline",
    short_name: "Roamline",
    description: "Share trips, moments, and the road between them.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f3",
    theme_color: "#171817",
    orientation: "portrait-primary",
    icons: [
      { src: "/roamline-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/roamline-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/roamline-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
