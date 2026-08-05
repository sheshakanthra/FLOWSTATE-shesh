import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const switzer = localFont({
  src: [
    { path: "../public/fonts/switzer-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/switzer-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/switzer-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/switzer-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
});

const commitMono = localFont({
  src: [{ path: "../public/fonts/commitmono-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-commit-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KILN",
  description: "The operating system for an AI automation agency.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-density="comfortable"
      className={`${switzer.variable} ${commitMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
