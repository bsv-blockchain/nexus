import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

// Required by output: "export" — the Nexus shell bundles this UI and serves it from
// file://, so every route must be emitted statically at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
