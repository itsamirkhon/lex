import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lex — BMW Legal AI Platform",
  description: "BMW Group Legal AI Agent Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
