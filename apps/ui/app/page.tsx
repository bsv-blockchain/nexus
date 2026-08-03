import { HubShell } from "@/components/hub/hub-shell";
import { createMetadata, siteConfig } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: siteConfig.name,
  description: siteConfig.description,
  path: "/",
});

export default function HomePage(): ReactNode {
  return <HubShell />;
}
