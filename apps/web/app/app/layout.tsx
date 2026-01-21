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
      <main className={styles.main}>{children}</main>
    </div>
  );
}
