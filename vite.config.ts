import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Publicado em https://cleidsonsg.github.io/comparador-precos/ : o build usa esse caminho;
// o servidor de desenvolvimento continua na raiz (http://127.0.0.1:5174/).
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/comparador-precos/" : "/",
  plugins: [react()],
  server: { host: true },
}));
