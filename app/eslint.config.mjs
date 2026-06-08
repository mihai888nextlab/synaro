import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "synaro-temporary-effect-sync-exemption",
    files: [
      "src/components/ui/project-workspace.tsx",
      "src/components/ui/projects-page-client.tsx",
      "src/pages/settings/profile.tsx",
    ],
    rules: {
      // React 19 / eslint-plugin-react-hooks strict mode flags common "sync props to state" patterns.
      // Prefer refactoring to keyed state or derived state; disable here until those components are updated.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
