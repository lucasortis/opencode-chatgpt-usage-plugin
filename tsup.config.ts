import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    tui: "src/tui.tsx",
  },
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  splitting: false,
  target: "esnext",
  treeshake: true,
  external: ["@opencode-ai/plugin", "@opentui/core", "@opentui/solid"],
  esbuildOptions(options) {
    options.jsx = "automatic"
    options.jsxImportSource = "@opentui/solid"
  },
})
