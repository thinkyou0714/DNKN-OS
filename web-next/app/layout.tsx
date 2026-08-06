import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@/components/analytics";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE.name} — 電験合格の学習OS`,
  description: SITE.description,
  metadataBase: new URL("https://thinkyou0714.github.io"),
  openGraph: {
    title: `${SITE.name} — 電験合格の学習OS`,
    description: SITE.description,
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
