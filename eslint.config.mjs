import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["build/**", "dist/**", "node_modules/**", "python/**", "assets/**"],
  },

  js.configs.recommended,

  // The React app: runs in the browser, talks to Electron through window.ascart
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ascart: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/prop-types": "off", // the project doesn't use PropTypes
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // Electron main process, preload scripts and build scripts: CommonJS on Node
  {
    files: ["electron/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_|^event$" }],
    },
  },

  // The widget page runs in a browser window and only sees widgetApi
  {
    files: ["electron/widget/widget.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, widgetApi: "readonly" },
    },
  },

  // Config files and tests
  {
    files: ["*.config.mjs", "vite.config.mjs", "e2e/**/*.js"],
    languageOptions: { sourceType: "module", globals: globals.node },
  },
  {
    files: ["src/**/*.test.{js,jsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // Turn off anything that would fight with Prettier
  prettier,
];
