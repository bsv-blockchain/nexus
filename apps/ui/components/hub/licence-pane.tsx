"use client";

import { content, licence } from "@/lib/data";
import { ExternalLink, Scale } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.licence;

/**
 * The terms this software is granted under, read in the app.
 *
 * Set as prose rather than as the monospaced block a LICENSE file arrives in: a
 * licence is meant to be read, and 58 lines of fixed-width text in a narrow
 * column is a thing people scroll past. Clauses indent and the disclaimer is set
 * apart, which is the shape the document already has — the wording is untouched.
 */
export function LicencePane(): ReactNode {
  return (
    <div>
      <div className="border-border/60 flex items-start gap-2.5 border-b p-4">
        <span className="bg-accent text-accent-foreground grid size-8 shrink-0 place-items-center rounded-lg">
          <Scale className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">
            {licence.name} {licence.version}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
            {copy.grantedBy} {licence.grantor}, {licence.address} (
            {licence.registration}).
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {licence.blocks.map((block, index) => (
          <p
            key={index}
            /* `anywhere` because clause (a) quotes a 64-character block hash,
               which is one unbreakable word and runs straight out of a pane this
               narrow. Only breaks where it has to, so prose is unaffected. */
            className={`wrap-anywhere ${
              block.kind === "notice"
                ? "border-border/60 text-muted-foreground mt-4 border-t pt-4 text-[10px] leading-relaxed"
                : block.kind === "clause"
                  ? "pl-4 text-xs leading-relaxed"
                  : "text-xs leading-relaxed"
            }`}
          >
            {block.body}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Out to the canonical copy, docked at the foot of the pane.
 *
 * The text above is what shipped with this build; this is the one it was taken
 * from. Anybody who wants to check the two agree should not have to take our
 * word for where it came from.
 */
export function LicencePaneFooter(): ReactNode {
  return (
    <a
      href={licence.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold"
    >
      <ExternalLink className="size-4" aria-hidden="true" />
      {copy.viewSource}
    </a>
  );
}
