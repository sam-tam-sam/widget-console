import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./theme.css";

export const metadata: Metadata = {
  applicationName: "Widget Console",
  title: { default: "Widget Console", template: "%s · Widget Console" },
  description: "Manage widget instances, embed links, and approved origins.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Widget Console" },
};

export const viewport: Viewport = { themeColor: "#244f3d" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
