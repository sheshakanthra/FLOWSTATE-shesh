import type { StorybookConfig } from "@storybook/nextjs";

// Next 15.4's config loader overrides Node's webpack module resolution to
// force its own compiled bundle, which @storybook/nextjs's own webpack
// dependencies don't expect — it crashes in Compiler.close() with
// "Cannot read properties of undefined (reading 'tap')". Setting this
// (private, Next-internal) env var puts the config loader in "render worker
// mode", where that resolution override is skipped. Same fix Storybook
// shipped internally for this exact crash (storybookjs/storybook#32313).
process.env.__NEXT_PRIVATE_RENDER_WORKER = "1";

const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.@(ts|tsx)",
    "../lib/**/*.stories.@(ts|tsx)",
    "../features/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y", "@storybook/addon-interactions"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
};

export default config;
