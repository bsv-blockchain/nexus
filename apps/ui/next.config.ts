import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nexus shell: the app bundles this UI and serves it from file:// so it works with no
  // network. That requires a fully static export with RELATIVE asset URLs — the default
  // absolute "/_next/..." resolves to filesystem root under file:// and loads nothing.
  // assetPrefix cannot be relative — next/font rejects anything not starting with "/" or
  // an absolute URL. The export is therefore built with absolute paths and rewritten to
  // relative afterwards by tools/bundle-ui.mjs, which is safe here because the app is a
  // single route (app/page.tsx), so there are no nested documents to resolve against.
  output: "export",
  trailingSlash: true,
  images: {
    // The export has no image optimisation server to call.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
