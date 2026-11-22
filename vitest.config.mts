import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/mocks/server-only.ts", import.meta.url)),
      "next/cache": fileURLToPath(new URL("./src/test/mocks/next-cache.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
