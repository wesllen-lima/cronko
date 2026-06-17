import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  prettier,

  // Base TS strict rules (no type info required — tsc handles type safety)
  ...tseslint.configs.strict.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/pnpm-lock.yaml",
      "**/vitest.config.ts",
      "**/vitest.workspace.ts",
      "**/drizzle.config.ts",
      "**/public/sw.js",
    ],
  },

  // Global TypeScript rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Security
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "@typescript-eslint/no-explicit-any": "warn",

      // Code quality
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },

  // packages/shared — strictest rules
  {
    files: ["packages/shared/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // packages/database — relaxed for ORM patterns
  {
    files: ["packages/database/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // apps/api — Hono middleware patterns
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // apps/web — React + Next.js rules (warn only — progressive migration)
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Convert React 19 strict rules to warnings for progressive migration
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": "off",
      // Pre-existing code style issues — warn, fix in later sprints
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-console": "warn",
    },
  },
);