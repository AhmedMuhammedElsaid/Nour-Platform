import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Nour — Admin",
  description: "Admin CMS",
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
