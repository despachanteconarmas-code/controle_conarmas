import { createRoot } from "react-dom/client";
import App from "./App";
import "./carteira.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker só em produção (no dev atrapalharia o recarregamento)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem SW o app funciona normalmente, só não abre offline */
    });
  });
}
