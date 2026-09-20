import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tessera Studio",
  description: "A modular 3D texture-painting studio.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
