import type { NextConfig } from "next";
import { pwaIcons } from "./src/lib/pwa-icons";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["argon2"],
  async rewrites() {
    // Installed apps may still reference the original icon URLs.
    return [
      { source: "/icon1.png", destination: pwaIcons.small },
      { source: "/icon2.png", destination: pwaIcons.large },
      { source: "/apple-icon.png", destination: pwaIcons.apple },
      { source: "/icon.svg", destination: pwaIcons.favicon },
    ];
  },
};

export default config;
