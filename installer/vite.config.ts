import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// RankDB Setup's page (installer/index.html): its own root and output, so it is served at "/" and
// only what the setup imports from src/ ships in it.
const project = resolve(import.meta.dirname, "..");

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  root: import.meta.dirname,
  server: {
    host: "127.0.0.1",
    port: 5181,
    strictPort: true,
    // The UI lives in src/installer and shares src/ and the app icons.
    fs: { allow: [project] },
  },
  build: {
    outDir: resolve(project, "dist-installer"),
    emptyOutDir: true,
  },
});
