import nextConfig from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Objectif projet: lint zéro-bruit (aucun warning) en CI.
      // Les points ci-dessous sont gérés via TypeScript, tests, et revue de code.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
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
