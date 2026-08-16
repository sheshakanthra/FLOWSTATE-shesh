import type { Preview, Decorator } from "@storybook/react";
import React, { useEffect } from "react";
import localFont from "next/font/local";
import { MotionProvider } from "../components/motion/motion-provider";
import { Toaster } from "../components/ui/toast";
import "../app/globals.css";

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

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "dark";
  const density = context.globals.density ?? "comfortable";
  const reduceMotion = context.globals.motion === "reduce";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(switzer.variable, commitMono.variable);
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-density", density);
  }, [theme, density]);

  return React.createElement(
    "div",
    { className: "bg-ink-000 p-section-gap text-fg-000", style: { minHeight: "100vh" } },
    React.createElement(
      MotionProvider,
      { forceReducedMotion: reduceMotion },
      React.createElement(Story),
      React.createElement(Toaster),
    ),
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    // Every route in this app is App Router (CLAUDE.md's stack table), so
    // this is a blanket, not per-story, setting. Without it,
    // @storybook/nextjs never wraps a story in Next's AppRouterContext, and
    // any component calling `useRouter`/`Link` from `next/navigation`
    // throws Next's own "invariant expected app router to be mounted"
    // instead of rendering -- agent-settings.tsx has called `useRouter`
    // since B6, so every Inspector story has been broken since then. Found
    // via this session's full e2e regression run, not a hypothetical.
    nextjs: { appDirectory: true },
    a11y: {
      test: "todo",
      config: {
        // These stories render a single primitive in isolation, not a full
        // document — document-landmark rules are meaningless noise here.
        rules: [
          { id: "landmark-one-main", enabled: false },
          { id: "page-has-heading-one", enabled: false },
          { id: "region", enabled: false },
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Color theme",
      defaultValue: "dark",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      name: "Density",
      description: "Control density",
      defaultValue: "comfortable",
      toolbar: {
        icon: "component",
        items: [
          { value: "comfortable", title: "Comfortable" },
          { value: "compact", title: "Compact" },
        ],
        dynamicTitle: true,
      },
    },
    motion: {
      name: "Motion",
      description: "prefers-reduced-motion override",
      defaultValue: "no-preference",
      toolbar: {
        icon: "transfer",
        items: [
          { value: "no-preference", title: "No preference" },
          { value: "reduce", title: "Reduce" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
