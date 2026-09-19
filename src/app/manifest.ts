import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hotel System",
    short_name: "HotelMS",
    description: "Hotel Management System for staff dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F5F7",
    theme_color: "#111111",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["business", "productivity"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    shortcuts: [
      {
        name: "Dashboard",
        url: "/",
        description: "View hotel dashboard",
      },
      {
        name: "Reservations",
        url: "/en",
        description: "View localized dashboard",
      },
    ],
  };
}
