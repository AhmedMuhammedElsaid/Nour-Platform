import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import { NavigationProgress } from "../components/navigation-progress";
import { NewtabPage } from "./newtab-page";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* Mounted once at the newtab root (not per-view inside NewtabPage,
          which has ~10 early-return view branches) so it survives every
          route switch without duplication. */}
      <NavigationProgress />
      <NewtabPage />
    </StrictMode>,
  );
}
