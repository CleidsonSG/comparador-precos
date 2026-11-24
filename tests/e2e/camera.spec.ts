// Escolha da câmera: com várias traseiras (nomes do Chrome do Android), usa a "camera 0, facing back" e lembra.
import { chromium, expect, test, type Browser } from "@playwright/test";

const BASE = "http://127.0.0.1:5181";

// Simula o celular do teste: 4 câmeras; o navegador, pedindo só "traseira", abriria a camera 2.
const FAKE_ANDROID = () => {
  const CAMS = [
    { deviceId: "f1", label: "camera 1, facing front" },
    { deviceId: "f3", label: "camera 3, facing front" },
    { deviceId: "b2", label: "camera 2, facing back" },
    { deviceId: "b0", label: "camera 0, facing back" },
  ];
  const w = window as unknown as { __asked: (string | null)[] };
  w.__asked = [];
  const md = navigator.mediaDevices;
  const orig = md.getUserMedia.bind(md);
  md.enumerateDevices = async () => CAMS.map((c) => ({ ...c, kind: "videoinput", groupId: "", toJSON() { return c; } }) as MediaDeviceInfo);
  md.getUserMedia = async (c?: MediaStreamConstraints) => {
    const v = (c?.video ?? {}) as MediaTrackConstraints;
    const asked = (v.deviceId as { exact?: string } | undefined)?.exact ?? null;
    w.__asked.push(asked);
    const s = await orig({ video: true });
    const t = s.getVideoTracks()[0];
    const gs = t.getSettings.bind(t);
    t.getSettings = () => ({ ...gs(), deviceId: asked ?? "b2" }); // sem pedir câmera: o navegador abre a camera 2
    return s;
  };
};

async function launch(): Promise<Browser> {
  return chromium.launch({ channel: "chrome", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
}

test("abre a traseira principal (camera 0), mostra nomes em português e lembra a escolha", async () => {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ permissions: ["camera"], baseURL: BASE });
    await ctx.addInitScript(() => localStorage.setItem("gondola.install.dismissed", "teste"));
    await ctx.addInitScript(FAKE_ANDROID);
    const page = await ctx.newPage();
    await page.goto("/#importar");
    await page.getByRole("button", { name: "Ler QR com a câmera" }).click();

    // 1ª vez: abre o que o navegador escolhe (camera 2) e troca sozinho para a camera 0
    await expect.poll(() => page.evaluate(() => (window as unknown as { __asked: (string | null)[] }).__asked)).toEqual([null, "b0"]);
    const select = page.getByLabel("Escolher câmera");
    await expect(select).toHaveValue("b0");
    await expect(select.locator("option:checked")).toHaveText("Traseira 0 (principal)");
    await expect(select.locator("option")).toHaveText(["Frontal 1", "Frontal 3", "Traseira 2", "Traseira 0 (principal)"]);
    expect(await page.evaluate(() => localStorage.getItem("gondola.camera"))).toBe("b0");

    // próximas vezes: já abre direto na camera 0
    await page.reload();
    await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __asked: (string | null)[] }).__asked)).toEqual(["b0"]);

    // escolha manual também é lembrada
    await page.getByLabel("Escolher câmera").selectOption("b2");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("gondola.camera"))).toBe("b2");
    await page.reload();
    await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __asked: (string | null)[] }).__asked)).toEqual(["b2"]);
  } finally {
    await browser.close();
  }
});

test("câmera lembrada que sumiu: volta para a escolha automática", async () => {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ permissions: ["camera"], baseURL: BASE });
    await ctx.addInitScript(() => {
      localStorage.setItem("gondola.install.dismissed", "teste");
      if (!sessionStorage.getItem("seeded")) { localStorage.setItem("gondola.camera", "sumiu"); sessionStorage.setItem("seeded", "1"); }
    });
    await ctx.addInitScript(FAKE_ANDROID);
    await ctx.addInitScript(() => {
      const md = navigator.mediaDevices;
      const prev = md.getUserMedia.bind(md);
      md.getUserMedia = async (c?: MediaStreamConstraints) => {
        const id = ((c?.video ?? {}) as { deviceId?: { exact?: string } }).deviceId?.exact;
        if (id === "sumiu") throw new DOMException("sem essa câmera", "OverconstrainedError");
        return prev(c);
      };
    });
    const page = await ctx.newPage();
    await page.goto("/#importar");
    await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
    await expect(page.getByLabel("Escolher câmera")).toHaveValue("b0");
    expect(await page.evaluate(() => localStorage.getItem("gondola.camera"))).toBe("b0");
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await browser.close();
  }
});

test("se a camera 0 recusar abrir, fica na outra traseira sem ficar trocando", async () => {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ permissions: ["camera"], baseURL: BASE });
    await ctx.addInitScript(() => localStorage.setItem("gondola.install.dismissed", "teste"));
    await ctx.addInitScript(FAKE_ANDROID);
    await ctx.addInitScript(() => {
      const md = navigator.mediaDevices;
      const prev = md.getUserMedia.bind(md);
      md.getUserMedia = async (c?: MediaStreamConstraints) => {
        const r = prev(c); // registra o pedido
        if (((c?.video ?? {}) as { deviceId?: { exact?: string } }).deviceId?.exact === "b0") {
          (await r).getTracks().forEach((t) => t.stop());
          throw new DOMException("não abre", "OverconstrainedError");
        }
        return r;
      };
    });
    const page = await ctx.newPage();
    await page.goto("/#importar");
    await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
    await expect(page.getByLabel("Escolher câmera")).toHaveValue("b2");
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __asked: (string | null)[] }).__asked)).toEqual([null, "b0", null]);
  } finally {
    await browser.close();
  }
});
