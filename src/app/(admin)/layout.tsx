import type { ReactNode } from "react";
import "./theme.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-theme">{children}</div>;
}
