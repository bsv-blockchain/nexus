"use client";

import { SiteFrame } from "@/components/apps/browser-app";
import type { HubApp } from "@/lib/data";
import type { ReactNode } from "react";

/**
 * A listing that is somebody else's site, under our app header.
 *
 * The pane carries no chrome of its own — no address bar, no back button —
 * because the rail already said this is an app, and an app with a URL bar in it
 * is a browser wearing a costume. Navigation inside the site still works; what
 * is missing is the ability to leave it, which is the point.
 *
 * Nothing here recolours the page. The profile's theme paints the surfaces
 * Nexus owns, and the moment it reached inside this frame it would be us
 * restyling a site we did not write.
 *
 * Hosts that refuse to be framed never reach this component: `openApp` sends
 * them to Browse instead, where the address bar and history they need already
 * exist. See `web.embeds` in the app data.
 */
export function WebAppView({ app }: { app: HubApp }): ReactNode {
  if (!app.web) return null;
  return <SiteFrame key={app.web.url} url={app.web.url} title={app.name} />;
}
