import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The page (src/index.html) lives with the code; the build still goes to dist/ for Tauri.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  root: "src",
  build: { outDir: "../dist", emptyOutDir: true },
});
