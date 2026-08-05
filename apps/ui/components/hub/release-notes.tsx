"use client";

import { IdentitySigil } from "@/components/hub/identity-sigil";
import { useHub } from "@/components/hub/hub-provider";
import { content, getRelease, releases } from "@/lib/data";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.releases;

/** "3 updates" / "1 update" — the count carries the plural. */
function updates(count: number): string {
  return `${count} ${count === 1 ? copy.update : copy.updates}`;
}

function releaseTitle(version: string): string {
  return `${copy.whatsNewIn} ${content.brand.name} v${version}`;
}

/**
 * Every release, newest first.
 *
 * The newest one is opened out into its features, because that is the release a
 * reader came for; the rest are one row each. Modelled on the pattern people
 * already know from an application's own What's new panel — a thumbnail, a
 * title, and how much changed — rather than a wall of version numbers.
 */
export function ReleaseList(): ReactNode {
  const { openDetailPane } = useHub();
  const [latest, ...past] = releases;
  if (!latest) return null;

  return (
    <div className="p-4">
      <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
        {copy.latest}
      </p>
      <h3 className="mt-1.5 text-base font-bold text-pretty">
        {releaseTitle(latest.version)}
      </h3>
      <p className="text-muted-foreground text-xs">
        {updates(latest.features.length)}
      </p>

      <ul className="divide-border/60 mt-2 divide-y">
        {latest.features.map((feature) => (
          <li key={feature.id}>
            <button
              type="button"
              onClick={() =>
                openDetailPane({ kind: "release", id: latest.version })
              }
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left"
            >
              {/* The feature's own sigil, so two rows in one release are still
                  telling apart at a glance. */}
              <IdentitySigil
                value={`${latest.version}:${feature.id}`}
                size={40}
                className="shrink-0 rounded-lg"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-pretty">
                  {feature.title}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                  {feature.summary}
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>

      {past.length > 0 && (
        <>
          <p className="text-muted-foreground mt-7 text-[11px] font-bold tracking-wide uppercase">
            {copy.past}
          </p>
          <ul className="divide-border/60 mt-2 divide-y">
            {past.map((release) => (
              <li key={release.version}>
                <button
                  type="button"
                  onClick={() =>
                    openDetailPane({ kind: "release", id: release.version })
                  }
                  className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left"
                >
                  <IdentitySigil
                    value={release.version}
                    size={40}
                    className="shrink-0 rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-pretty">
                      {releaseTitle(release.version)}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px]">
                      {updates(release.features.length)}
                    </span>
                  </span>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * One release, in full.
 *
 * Its features are laid out here rather than behind a third level of navigation:
 * a release has a handful of them, each is a couple of paragraphs, and making
 * somebody open every one to find out what changed defeats the panel.
 */
export function ReleaseDetail({ version }: { version: string }): ReactNode {
  const { openDetailPane } = useHub();
  const release = getRelease(version);
  if (!release) return null;
  const index = releases.findIndex((entry) => entry.version === version);
  const next = releases[index + 1];

  return (
    <div>
      {/* The release's own mark, as the band the reference puts a hero image in.
          Generated from the version, so a new entry needs no artwork. */}
      <div className="border-border/60 flex items-center gap-3 border-b p-4">
        <IdentitySigil
          value={release.version}
          size={56}
          className="shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-pretty">
            {releaseTitle(release.version)}
          </h3>
          <p className="text-muted-foreground text-[11px]">
            {updates(release.features.length)} ·{" "}
            <time dateTime={release.date}>{release.date}</time>
          </p>
        </div>
      </div>

      <p className="text-muted-foreground px-4 pt-3 text-xs text-pretty italic">
        {release.headline}
      </p>

      <div className="divide-border/60 mt-1 divide-y">
        {release.features.map((feature) => (
          <section key={feature.id} className="p-4">
            <div className="flex items-start gap-3">
              <IdentitySigil
                value={`${release.version}:${feature.id}`}
                size={32}
                className="mt-0.5 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-pretty">
                  {feature.title}
                </h4>
                {feature.reference && (
                  <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                    {feature.reference}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-pretty">
              {feature.body}
            </p>
            {feature.steps && (
              <ol className="mt-2.5 space-y-1.5">
                {feature.steps.map((step, stepIndex) => (
                  <li key={step} className="flex items-start gap-2">
                    <span
                      className="text-muted-foreground mt-px w-3.5 shrink-0 text-right text-[11px] font-semibold tabular-nums"
                      aria-hidden="true"
                    >
                      {stepIndex + 1}.
                    </span>
                    <span className="text-[11px] leading-relaxed text-pretty">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      {/* The way onward, as the reference has it: the release before this one. */}
      {next && (
        <button
          type="button"
          onClick={() => openDetailPane({ kind: "release", id: next.version })}
          className="focus-ring border-border hover:bg-surface-hover flex w-full items-center gap-3 border-t p-4 text-left"
        >
          <IdentitySigil
            value={next.version}
            size={36}
            className="shrink-0 rounded-lg"
          />
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground block text-[10px] font-bold tracking-wide uppercase">
              {copy.before}
            </span>
            <span className="block truncate text-sm font-semibold">
              {releaseTitle(next.version)}
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
