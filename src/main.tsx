import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {
  /* sem armazenamento: segue o tema do sistema */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
