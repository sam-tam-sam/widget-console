import Link from "next/link";
import type { ReactNode } from "react";
import { Blocks, ChartNoAxesColumnIncreasing, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import "./dashboard.css";

type AdminShellProps = {
  username: string;
  children: ReactNode;
  activeSection?: "widgets" | "analytics";
};

export function AdminShell({ username, children, activeSection = "widgets" }: AdminShellProps) {
  const initial = username.trim().charAt(0).toLocaleUpperCase() || "A";

  return (
    <div className="console-shell">
      <a className="console-skip" href="#console-main">Skip to content</a>
      <aside className="console-sidebar">
        <Link href="/admin" className="console-brand">
          <span className="console-brand-mark"><Blocks size={19} aria-hidden="true" /></span>
          <span>Widget Console</span>
        </Link>
        <nav className="console-nav" aria-label="Admin navigation">
          <Link href="/admin" aria-current={activeSection === "widgets" ? "page" : undefined}>
            <LayoutDashboard size={17} aria-hidden="true" /> Widgets
          </Link>
          <Link href="/admin/analytics" aria-current={activeSection === "analytics" ? "page" : undefined}>
            <ChartNoAxesColumnIncreasing size={17} aria-hidden="true" /> Analytics
          </Link>
        </nav>
        <div className="console-profile">
          <span className="console-avatar" aria-hidden="true">{initial}</span>
          <span className="console-profile-name"><strong>{username}</strong><small>Administrator</small></span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
              <LogOut aria-hidden="true" />
            </Button>
          </form>
        </div>
      </aside>
      <main className="console-main" id="console-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
