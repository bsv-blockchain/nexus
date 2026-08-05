import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Markup for the 1200x630 Open Graph card.
 *
 * Every asset is inlined as a data URI so the page renders identically in
 * headless Chrome with no network — a remote font or image that fails to load
 * produces a card that is subtly wrong rather than one that fails loudly.
 *
 * Copy comes from `lib/data/content.ts` via the build script rather than being
 * written here, so the card cannot drift from the product's own wording.
 */
export function buildOgHtml(root, { name, tagline, description }) {
  const dataUri = (relPath, mime) =>
    `data:${mime};base64,${readFileSync(join(root, relPath)).toString("base64")}`;

  const heroImage = dataUri("public/img/hero-image.png", "image/png");
  const mark = dataUri("public/icons/nexus.png", "image/png");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }

      html, body {
        width: 1200px;
        height: 630px;
        overflow: hidden;
      }

      body {
        position: relative;
        display: flex;
        align-items: center;
        /* The dark theme's own background, so a share preview and the app
           agree about what colour the product is. */
        background: #17111f;
        color: #ffffff;
        font-family: "Geist", "Inter", -apple-system, system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      /* Accent bloom behind the product shot, reading as backlight rather
         than as a corner smudge. #4353ff is the app's accent token. */
      .glow-right {
        position: absolute;
        top: 50%;
        right: -170px;
        width: 900px;
        height: 900px;
        transform: translateY(-52%);
        border-radius: 50%;
        background: radial-gradient(
          circle,
          rgba(67, 83, 255, 0.26) 0%,
          rgba(67, 83, 255, 0.10) 38%,
          rgba(23, 17, 31, 0) 66%
        );
      }

      .glow-left {
        position: absolute;
        bottom: -320px;
        left: -220px;
        width: 780px;
        height: 780px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          rgba(120, 60, 200, 0.28) 0%,
          rgba(23, 17, 31, 0) 68%
        );
      }

      /* Pushed right so the canvas edge crops the laptop, and lifted so the
         brand row clears it along the bottom. */
      .hero-shot {
        position: absolute;
        top: 50%;
        right: -190px;
        transform: translateY(-46%);
        width: 700px;
        height: auto;
      }

      /* The bottom padding reserves the band the brand row is pinned into
         and sets how far down the centred text sits. */
      .content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 0 62px 64px;
        width: 630px;
        height: 100%;
      }

      h1 {
        font-size: 57px;
        font-weight: 700;
        line-height: 1.09;
        letter-spacing: -0.032em;
      }

      .desc {
        margin-top: 22px;
        max-width: 580px;
        font-size: 27px;
        font-weight: 500;
        line-height: 1.34;
        letter-spacing: -0.014em;
        text-wrap: balance;
        color: rgba(255, 255, 255, 0.95);
      }

      /* Pinned to the bottom edge and free to run wider than the copy
         column, so it passes under the product shot. */
      .brand {
        position: absolute;
        left: 64px;
        bottom: 46px;
        z-index: 3;
        display: flex;
        align-items: center;
        gap: 18px;
        white-space: nowrap;
      }

      .brand img {
        width: 56px;
        height: 56px;
        border-radius: 13px;
        display: block;
      }

      .wordmark {
        font-size: 30px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
    </style>
  </head>
  <body>
    <div class="glow-left"></div>
    <div class="glow-right"></div>
    <img class="hero-shot" src="${heroImage}" alt="" />

    <div class="content">
      <h1>${tagline}</h1>
      <p class="desc">${description}</p>
    </div>

    <div class="brand">
      <img src="${mark}" alt="" />
      <span class="wordmark">${name}</span>
    </div>
  </body>
</html>
`;
}
