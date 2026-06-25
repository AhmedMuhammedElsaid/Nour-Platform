import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import { NewtabPage } from "./newtab-page";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <NewtabPage />
    </StrictMode>,
  );
}
