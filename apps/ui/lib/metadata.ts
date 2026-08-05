import type { Metadata } from "next";
import { content } from "./data/content";
import { OG_IMAGE_VERSION } from "./og-image-version";

export const siteConfig = {
  name: content.brand.name,
  description: content.brand.description,
  tagline: content.brand.tagline,
  /*
   * Production origin, and the one value here that cannot be a placeholder.
   * `metadataBase` is built from it, so canonical, og:image and twitter:image
   * all resolve against it — the earlier `https://example.com` meant every
   * scraper fetched the card from a domain nobody owns.
   *
   * PROVISIONAL: the default Vercel host for the `bsvnexus` repo. Swap in the
   * real apex before launch; nothing else here needs to change.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://bsvnexus.vercel.app",
  ogImage: "/og-image.png",
  creator: "@bsvblockchain",
  authors: [{ name: "BSV Association", url: "https://bsvblockchain.org" }],
  keywords: [
    "Nexus",
    "BSV",
    "browser",
    "wallet",
    "digital identity",
    "micropayments",
    "document signing",
    "publishing",
    "Metanet",
    "self-custodial",
  ],
} as const;

/**
 * Absolute production URL for a site-root path.
 *
 * Crawlers and social scrapers resolve og:image, twitter:image and canonical
 * against their *own* origin, so each of those ships fully qualified.
 * Root-relative works in a browser and silently breaks in a link preview.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url).toString();
}

/**
 * The card URL carries a content hash.
 *
 * Slack caches link previews for roughly 24 hours and offers no manual purge,
 * so an updated image at an unchanged URL keeps serving the old one for a day.
 * A new URL is the only reliable bust. The hash comes from `npm run build:og`,
 * so it changes exactly when the image does and never when it does not.
 */
const ogImageUrl = `${absoluteUrl(siteConfig.ogImage)}?v=${OG_IMAGE_VERSION}`;

/** 1200x630 is what Facebook, LinkedIn, X and Slack all render at. */
const ogImageSize = { width: 1200, height: 630 } as const;

/**
 * Favicons, PWA icons and the Apple touch icon, all absolute so the same
 * markup resolves identically wherever the page is scraped from.
 *
 * Rendered `<link rel="icon">` order matters: browsers take the last usable
 * match, so the largest PNG goes last. There is no SVG entry because the brand
 * mark exists only as raster art — add one and it belongs at the end.
 */
const icons: Metadata["icons"] = {
  icon: [
    { url: absoluteUrl("/favicon.ico"), sizes: "any", rel: "icon" },
    {
      url: absoluteUrl("/favicon-16x16.png"),
      sizes: "16x16",
      type: "image/png",
    },
    {
      url: absoluteUrl("/favicon-32x32.png"),
      sizes: "32x32",
      type: "image/png",
    },
    { url: absoluteUrl("/icon-192.png"), sizes: "192x192", type: "image/png" },
  ],
  shortcut: [absoluteUrl("/favicon.ico")],
  apple: [
    {
      url: absoluteUrl("/apple-touch-icon.png"),
      sizes: "180x180",
      type: "image/png",
    },
  ],
};

export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [...siteConfig.authors],
  creator: siteConfig.creator,
  publisher: siteConfig.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: ogImageUrl,
        ...ogImageSize,
        type: "image/png",
        alt: `${siteConfig.name} on desktop, tablet, phone and watch`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: ogImageUrl, ...ogImageSize, alt: siteConfig.name }],
    site: siteConfig.creator,
    creator: siteConfig.creator,
  },
  icons,
  /* Root-relative on purpose: an absolute manifest URL is cross-origin on
     localhost and preview deploys, which browsers reject without CORS. */
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    /* appleWebApp.capable emits only the modern mobile-web-app-capable, so the
       legacy Apple name — still what older iOS reads — is added by hand. */
    "apple-mobile-web-app-capable": "yes",
  },
};

export function createMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image ? absoluteUrl(image) : ogImageUrl;
  const resolvedTitle = title ?? siteConfig.name;
  const resolvedDescription = description ?? siteConfig.description;

  /* Next replaces the parent openGraph/twitter objects wholesale rather than
     merging them, so every shared field is repeated here. Omitting them is
     what silently drops siteName, locale, card type and creator from any page
     that calls this. */
  return {
    title,
    description: resolvedDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: siteConfig.name,
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      images: [
        {
          url: ogImage,
          ...ogImageSize,
          type: "image/png",
          alt: resolvedTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [{ url: ogImage, ...ogImageSize, alt: resolvedTitle }],
      site: siteConfig.creator,
      creator: siteConfig.creator,
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
