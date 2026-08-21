import type { Metadata } from "next";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/motion/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  // Not preloaded: this is a shared root layout, so next/font's default
  // eager preload otherwise fetches this file on every route including the
  // marketing hero (E1), which never renders `font-mono` text and has a
  // 1.2s LCP budget under throttled mobile -- competing render-blocking-CSS
  // and font requests for the same slow pipe measured real LCP at ~1.8s
  // before this. `display: "swap"` already covers the fallback-then-swap
  // behavior for whichever authenticated-app screen first renders mono text.
  preload: false,
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
      <body>
        <MotionProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
