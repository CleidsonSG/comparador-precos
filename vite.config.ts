import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Publicado em https://cleidsonsg.github.io/comparador-precos/ : o build usa esse caminho;
// o servidor de desenvolvimento continua na raiz (http://127.0.0.1:5174/).
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/comparador-precos/" : "/",
  plugins: [
    react(),
    // Service worker (src/sw.ts): o app abre sem internet. Só no build; no desenvolvimento fica desligado.
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      manifest: false, // o manifesto fica em public/manifest.webmanifest
      injectManifest: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,wasm,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // leitor de PDF (~1,3 MB) e de QR (~0,9 MB)
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true },
}));
