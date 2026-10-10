import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Accept direct billing URLs while preserving the app's existing hash routes.
if (
  !window.location.hash.startsWith("#/") &&
  ["/upgrade", "/checkout"].includes(window.location.pathname)
) {
  window.history.replaceState(
    null,
    "",
    `/#${window.location.pathname}${window.location.search}`,
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
