import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  // En desarrollo, las rutas de servidor leen .env (SUPABASE_SECRET_KEY, MODEL_API_URL…) desde
  // process.env. En la VPS las define systemd (/etc/galena-ai.env).
  if (command === "serve") {
    for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
      process.env[key] ??= value;
    }
  }

  return {
    // Prefijo público: "/" en producción; la instancia dev se compila con APP_BASE_PATH=/dev/.
    base: process.env["APP_BASE_PATH"] ?? "/",
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Use src/server.ts (our SSR error wrapper) as the server entry.
        server: { entry: "server" },
      }),
      // Por defecto compila un servidor Node autónomo (.output/server/index.mjs) para la VPS
      // detrás de nginx. NITRO_PRESET=vercel o cloudflare_module compila para esas plataformas,
      // que ejecutan las rutas /api/public/* como funciones en su capa gratuita.
      ...(command === "build"
        ? [nitro({ preset: process.env["NITRO_PRESET"] ?? "node-server" })]
        : []),
      viteReact(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
    server: {
      host: "::",
      port: 8080,
    },
  };
});
