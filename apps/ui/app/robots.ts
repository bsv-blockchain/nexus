import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

// Required by output: "export" — the Nexus shell bundles this UI and serves it from
// file://, so every route must be emitted statically at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/private/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
