// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import localPlugin from "./eslint-plugin-local/no-color-literals.js";

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      "local/no-color-literals": "error",
    },
  },
);
