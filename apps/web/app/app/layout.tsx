import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import styles from "./layout.module.css";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.brand}>Inplain</div>
        <div className={styles.links}>
          <Link className={styles.link} href="/app">
            Dashboard
          </Link>
          <Link className={styles.link} href="/app/entities">
            Entities
          </Link>
          <Link className={styles.link} href="/app/settings">
            Settings
          </Link>
        </div>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

