import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./not-found.module.css";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className={`admin-theme ${styles.page}`}>
      <div className={styles.layout}>
        <section className={styles.copy} aria-labelledby="not-found-title">
          <p className={styles.brand}>Widget Console</p>
          <h1 id="not-found-title">Page not found</h1>
          <p className={styles.description}>This address may be outdated, or the page may have moved.</p>
          <Button asChild size="lg">
            <Link href="/" prefetch={false}>Return home</Link>
          </Button>
        </section>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.code}>
            <span>4</span>
            <span className={styles.zero}>0</span>
            <span>4</span>
          </div>
        </div>
      </div>
    </main>
  );
}
