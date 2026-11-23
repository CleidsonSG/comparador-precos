export type ThemePref = "auto" | "light" | "dark";

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function setThemePref(t: ThemePref): void {
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", t);
  } catch {
    /* ignora */
  }
  window.dispatchEvent(new Event("gondola:theme"));
}

/** Botão da lua: alterna entre claro e escuro a partir do que está na tela agora. */
export function toggleTheme(): void {
  const cur = document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  setThemePref(cur === "dark" ? "light" : "dark");
}
