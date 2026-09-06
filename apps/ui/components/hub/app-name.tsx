"use client";

import type { HubApp } from "@/lib/data";
import type { ReactNode } from "react";

/** The letters a dropped-vowel wordmark is a word without. */
const VOWEL = /[aeiou]/i;

/**
 * An app's name, spelled the way its publisher writes it.
 *
 * Some wordmarks are the word with its vowels dropped — clndr.im is Calendar
 * without the a, e and a. Setting them at a third of the weight rather than
 * leaving them out means the listing still says "Calendar": the word is intact
 * for anybody reading it aloud, searching for it, or hearing it announced, and
 * only the eye does the dropping.
 *
 * A component rather than markup in the data, because `name` is read in about
 * thirty places and most of them — search, `aria-label`, toasts, tooltips,
 * window titles — want the plain string. This is for the handful that are prose
 * on a screen; everywhere else keeps reading `app.name` and is right to.
 */
export function AppName({
  app,
  short = false,
}: {
  app: HubApp;
  /** use `shortName`, for the places a full name would not fit */
  short?: boolean;
}): ReactNode {
  const name = short ? app.shortName : app.name;
  if (app.quietVowels !== true) return <>{name}</>;
  return (
    <>
      {[...name].map((letter, index) =>
        VOWEL.test(letter) ? (
          <span key={`${letter}${index}`} className="opacity-35">
            {letter}
          </span>
        ) : (
          letter
        ),
      )}
    </>
  );
}
