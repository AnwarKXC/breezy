import type { MetadataRoute } from "next";
import { getBranding } from "@/shared/branding/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { displayName } = await getBranding();
  return {
    id: "/",
    name: displayName,
    short_name: displayName,
    description: "Hotel Management System for staff dashboard",
    start_url: "/en/reservations",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1A1A1A",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Reservations", url: "/en/reservations", description: "Open reservations" },
    ],
  };
}
