"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/*
 * Root-segment error boundary. Reports the crash to Sentry (no-op if no DSN
 * is configured) and renders a minimal fallback. Cannot use the app's styled
 * layout because the layout itself may have thrown.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html>
      <body>
        <main style={{ padding: "4rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
        </main>
      </body>
    </html>
  );
}
