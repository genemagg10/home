import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeBase — your house, in one place",
  description: "A living manual & status board for your home, with an AI that knows it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
