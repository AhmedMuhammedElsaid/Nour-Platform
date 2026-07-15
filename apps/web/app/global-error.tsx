"use client";

/*
 * Last-resort boundary: catches crashes in the root/locale LAYOUT itself, which
 * means it replaces the whole document and must render its own <html>/<body>.
 * Critically, there is NO NextIntlClientProvider and no resolved locale here —
 * the layout that would have supplied them is what failed — so the copy is
 * static bilingual (AR + EN stacked) and the styles are inline: globals.css is
 * imported by the locale layout, so Tailwind tokens are not guaranteed to be
 * available on this path. Colours use CSS system keywords (Canvas/CanvasText)
 * so the page follows the OS light/dark theme without hard-coded hex.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    // `lang`/`dir` default to Arabic-first, matching the product default locale.
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          padding: "2rem",
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          textAlign: "center",
        }}
      >
        <section dir="rtl">
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>
            حدث خطأ ما
          </h1>
          <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.7 }}>
            تعذّر تحميل الصفحة. من فضلك حاول مرة أخرى.
          </p>
        </section>

        <section dir="ltr">
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.7 }}>
            The page failed to load. Please try again.
          </p>
        </section>

        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: "1px solid CanvasText",
            borderRadius: "9999px",
            background: "transparent",
            color: "CanvasText",
            cursor: "pointer",
            font: "inherit",
            fontWeight: 600,
            padding: "0.625rem 1.5rem",
          }}
        >
          حاول مرة أخرى · Try again
        </button>
      </body>
    </html>
  );
}
