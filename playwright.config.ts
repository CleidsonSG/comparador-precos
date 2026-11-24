import { defineConfig } from "@playwright/test";

// Testes no navegador (Chrome instalado no computador). Rodar: npm run test:e2e
// app: servidor de desenvolvimento. pwa: build de produção (service worker, offline, compartilhar).
const DEV = 5181;
const PROD = 5182;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    channel: "chrome",
    // a chave de teste é falsa, mas fotos reais não devem parar em capturas de tela
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    { name: "app", testIgnore: /pwa\.spec/, use: { baseURL: `http://127.0.0.1:${DEV}` } },
    { name: "pwa", testMatch: /pwa\.spec/, use: { baseURL: `http://127.0.0.1:${PROD}/comparador-precos/` } },
  ],
  webServer: [
    { command: `npx vite --port ${DEV} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${DEV}`, reuseExistingServer: true },
    {
      command: `npm run build && npx vite preview --port ${PROD} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PROD}/comparador-precos/`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
