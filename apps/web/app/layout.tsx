import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Nour — Audio Platform",
  description: "Islamic audio platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          background: "#FCFCF9",
          color: "#13201A",
        }}
      >
        {children}
      </body>
    </html>
  );
}
