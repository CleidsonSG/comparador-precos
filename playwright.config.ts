import { defineConfig } from "@playwright/test";

// Testes no navegador (Chrome instalado no computador). Rodar: npm run test:e2e
const PORT = 5181;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    // a chave de teste é falsa, mas fotos reais não devem parar em capturas de tela
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
  },
});
