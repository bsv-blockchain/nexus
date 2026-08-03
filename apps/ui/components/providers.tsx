"use client";

import { ScrollWatcher } from "@/components/scroll-watcher";
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
        {/* No `richColors`: its tinted cards are hardcoded and ignore a custom
            theme. Toasts take the Nexus surface from globals.css instead, with
            the type carried by the icon colour. */}
        <Toaster position="bottom-right" theme="system" closeButton />
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
