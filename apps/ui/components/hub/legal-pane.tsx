"use client";

/**
 * The terms of use and the privacy note, as two tabs of one pane.
 *
 * They are separate documents and they belong beside each other: nobody reads
 * one without wondering about the other, and putting them in two places would
 * mean two rows in a menu that both say "the boring one".
 *
 * The tab lives here rather than in the pane's caller because it is a reading
 * position, not navigation — closing the pane and opening it again should not
 * be the way you get back to Privacy, and nothing outside this component has
 * any reason to know which of the two is showing.
 *
 * @see lib/data/legal.ts — the documents
 * @see components/hub/licence-pane.tsx — the licence, which is a different thing
 */

import { content, legalDocuments, legalUpdated } from "@/lib/data";
import { useState, type ReactNode } from "react";

const copy = content.legal;

export function LegalPane(): ReactNode {
  const [active, setActive] = useState<"terms" | "privacy">("terms");
  /* Not `document`: that name is the global one, and shadowing it inside a
     component is a trap for whoever adds a `document.querySelector` here next. */
  const shown = legalDocuments.find((entry) => entry.id === active);
  if (!shown) return null;

  return (
    <div>
      {/* Sticky, because these are long and the tab is how you get out of one
          of them. A control that scrolls away is a control you have to scroll
          back for. */}
      <div className="bg-surface-raised/95 sticky top-0 z-10 p-3 pb-2 backdrop-blur">
        <div
          role="tablist"
          aria-label={copy.title}
          className="bg-surface ring-border/60 grid grid-cols-2 gap-0.5 rounded-lg p-0.5 ring-1"
        >
          {legalDocuments.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === active}
              onClick={() => setActive(entry.id)}
              className={`focus-ring rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                entry.id === active
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry.tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-1 pb-5">
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {shown.intro}
        </p>

        {shown.sections.map((section) => (
          <section key={section.heading} className="mt-5">
            <h3 className="text-sm font-bold text-pretty">{section.heading}</h3>
            {section.body.map((paragraph, index) => (
              <p
                key={index}
                className="text-muted-foreground mt-2 text-xs leading-relaxed text-pretty"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        {/* Said once, at the bottom of both, where somebody who has actually
            read to the end of one is the person it is for. */}
        <p className="border-border/60 text-muted-foreground mt-6 border-t pt-4 text-[10px] leading-relaxed">
          {copy.updated} {legalUpdated}. {copy.disclaimer}
        </p>
      </div>
    </div>
  );
}
