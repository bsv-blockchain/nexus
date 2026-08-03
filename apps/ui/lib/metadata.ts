import type { Metadata } from "next";

export const siteConfig = {
  name: "Nexus",
  description:
    "Nexus bundles a browser, wallet, document signing, publishing and transaction tools into one BSV workspace.",
  url: "https://example.com",
  ogImage: "/og-image.png",
  creator: "@nexus",
  authors: [
    {
      name: "Nexus",
      url: "https://example.com",
    },
  ],
  keywords: [
    "BSV",
    "browser",
    "wallet",
    "blockchain",
    "document signing",
    "publishing",
  ],
} as const;

export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
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
    canonical: "/",
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
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: siteConfig.creator,
  },
  icons: {
    icon: "/icons/nexus.png",
    shortcut: "/icons/nexus.png",
    apple: "/icons/nexus.png",
  },
  manifest: "/site.webmanifest",
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
  const url = `${siteConfig.url}${path}`;
  const ogImage = image ?? siteConfig.ogImage;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: title ?? siteConfig.name,
      description: description ?? siteConfig.description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title ?? siteConfig.name,
        },
      ],
    },
    twitter: {
      title: title ?? siteConfig.name,
      description: description ?? siteConfig.description,
      images: [ogImage],
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
