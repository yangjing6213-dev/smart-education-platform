import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "artifacts/**", "phase-inputs/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
];
