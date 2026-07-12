import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volt Tackle — AI Incident Response",
  description:
    "A senior-engineer-in-a-box: AI incident response, safety-gated remediation, and multi-agent repo postmortems for startup engineering teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
