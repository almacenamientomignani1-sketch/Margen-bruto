import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config de Vite. En desarrollo local, /api/remarkets/* lo sirve
// `wrangler pages dev` (ver README) — no hace falta proxy acá.
export default defineConfig({
  plugins: [react()],
});
