import { Providers } from "@/components/providers";
import { SkipToContent } from "@/components/skip-to-content";
import { Agentation } from "agentation";
import { baseMetadata } from "@/lib/metadata";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = baseMetadata;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e8ee" },
    { media: "(prefers-color-scheme: dark)", color: "#17111f" },
  ],
  width: "device-width",
  initialScale: 1,
  // This UI ships inside a native shell, where pinch-zoom is a browser affordance that
  // breaks the illusion immediately — nothing else on the phone zooms like that. Locking
  // the scale is what makes the WebView stop feeling like a web page.
  maximumScale: 1,
  userScalable: false,
  // Draw into the notch/home-indicator area; the chrome pads itself with env(safe-area-*).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        Extensions inject attributes onto <body> before React hydrates —
        ColorZilla's `cz-shortcut-listen` is the common one — which React then
        reports as a mismatch. Suppressing here covers only attributes on this
        element, not its subtree, so genuine mismatches inside the app still
        surface.
      */}
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <Providers>
          <SkipToContent />
          {children}
        </Providers>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
