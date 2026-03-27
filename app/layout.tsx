import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brandly — AI-Powered Brand Content Platform",
  description: "Build your Brand DNA, generate on-brand content, and automate social media publishing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
