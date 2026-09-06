/**
 * table: languages — what a page is asked for when it offers a choice.
 *
 * A short list rather than every tag in BCP-47. This setting sends an
 * `Accept-Language` header; a picker with two hundred rows makes finding your
 * own harder than typing it, and nothing in the prototype serves translations
 * anyway. Written in each language's own name, because somebody looking for
 * Deutsch is not scanning for "German".
 */

export interface Language {
  /** BCP-47 tag, which is what actually goes on the wire */
  tag: string;
  /** the language's name in itself */
  name: string;
  /** the same in English, for anybody who landed here by accident */
  english: string;
}

export const languages: Language[] = [
  { tag: "en-GB", name: "English (UK)", english: "English (UK)" },
  { tag: "en-US", name: "English (US)", english: "English (US)" },
  { tag: "de-CH", name: "Deutsch (Schweiz)", english: "German (Switzerland)" },
  { tag: "fr-CH", name: "Français (Suisse)", english: "French (Switzerland)" },
  {
    tag: "it-CH",
    name: "Italiano (Svizzera)",
    english: "Italian (Switzerland)",
  },
  { tag: "es-ES", name: "Español", english: "Spanish" },
  { tag: "pt-BR", name: "Português (Brasil)", english: "Portuguese (Brazil)" },
  { tag: "ja-JP", name: "日本語", english: "Japanese" },
  { tag: "zh-CN", name: "中文（简体）", english: "Chinese (Simplified)" },
];

export function getLanguage(tag: string): Language | undefined {
  return languages.find((entry) => entry.tag === tag);
}
