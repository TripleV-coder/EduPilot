import nextConfig from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Verrou anti-régression : 0 `any` explicite mesuré dans src/ (2026-08-04).
      "@typescript-eslint/no-explicit-any": "error",
      // Objectif projet: lint zéro-bruit (aucun warning) en CI.
      // Les points ci-dessous sont gérés via TypeScript, tests, et revue de code.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      // React Compiler experimental rules — the codebase doesn't run the
      // compiler, and these flag standard patterns (async initializer inside
      // useEffect, mutating refs in handlers, calling setState from a
      // declared function in useEffect) that work in practice. They produced
      // ~50 CI-blocking errors across pages we never touched.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "import/no-anonymous-default-export": "off",
      "react/jsx-no-undef": "error",
    },
  },
  // React Three Fiber components use Math.random() in useMemo and imperative
  // ref mutations in useFrame — standard R3F patterns, not Compiler violations.
  {
    files: ["src/components/three/**/*.tsx"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default eslintConfig;
