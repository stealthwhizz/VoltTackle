import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Focused unit tests colocated with the highest-risk logic.
    include: ["packages/**/src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
