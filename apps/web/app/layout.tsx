import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coffee Snob — Find coffee worth the detour",
  description:
    "A curated guide to specialty coffee, city by city. Five to ten shops per city, chosen against written standards, not crowdsourced ratings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
