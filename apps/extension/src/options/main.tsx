import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import { OptionsPage } from "./options-page";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OptionsPage />
    </StrictMode>,
  );
}
