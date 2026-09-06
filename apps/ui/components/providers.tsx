"use client";

import { ScrollWatcher } from "@/components/scroll-watcher";
import { SpendAuthorization } from "@/components/hub/spend-authorization";
import { themeConfig } from "@/lib/config";
import { ReducedMotionProvider } from "@/lib/motion";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={themeConfig.defaultTheme}
      enableSystem={themeConfig.enableSystemTheme}
      disableTransitionOnChange
    >
      <ReducedMotionProvider>
        <ScrollWatcher />
        {children}
        {/* Mounted at the root, not inside the browser app: a spend request can
            arrive while the user is on any screen — they may have switched to
            the wallet while a page was mid-payment — and the wallet is blocked
            until it is answered wherever they happen to be. */}
        <SpendAuthorization />
        {/* No `richColors`: its tinted cards are hardcoded and ignore a custom
            theme. Toasts take the Nexus surface from globals.css instead, with
            the type carried by the icon colour. */}
        {/* Top centre, not bottom right.

            The browsed page is a native view stacked above this document, and
            it fills the canvas from the address bar down — so a toast in the
            bottom corner was raised into the one region of the window it could
            not be seen in. The top of the window is chrome on every layout. */}
        <Toaster position="top-center" theme="system" closeButton />
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
