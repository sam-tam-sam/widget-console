import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Widget Console",
    short_name: "Widgets",
    description: "Manage widget instances, embed links, and approved origins.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f0",
    theme_color: "#244f3d",
    icons: [
      { src: "/icon1.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
