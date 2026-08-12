/**
 * table: search_engines — what the address bar asks when you type a question.
 *
 * Ordered by what this product would rather you used, not by market share.
 * MetaSearch is first because it is the one that searches the chain; the rest
 * run from least to most interested in who is asking. Google and Bing are last
 * and still present: a browser that only offers the choices it approves of is
 * making the choice for you.
 */

export interface SearchEngine {
  id: string;
  name: string;
  /** what it is, in the few words a settings row can hold */
  hint: string;
  /** the host its mark is fetched from; MetaSearch ships its own */
  host?: string;
  /** local artwork, where there is no favicon worth using */
  iconSrc?: string;
  /** fallback tile colour and letter when the mark will not load */
  color: string;
}

export const searchEngines: SearchEngine[] = [
  {
    id: "metasearch",
    name: "MetaSearch",
    hint: "Searches what is on chain as well as what is on the web.",
    iconSrc: "/search/metasearch.png",
    color: "#1f7f8c",
  },
  {
    id: "brave",
    name: "Brave",
    hint: "Its own index, and no profile built from your queries.",
    host: "search.brave.com",
    color: "#fb542b",
  },
  {
    id: "startpage",
    name: "StartPage",
    hint: "Google's results, fetched on your behalf so they never see you.",
    host: "startpage.com",
    color: "#6577f0",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    hint: "No search history, no profile.",
    host: "duckduckgo.com",
    color: "#de5833",
  },
  {
    id: "ecosia",
    name: "Ecosia",
    hint: "Bing's results; the profit plants trees.",
    host: "ecosia.org",
    color: "#0f8f5a",
  },
  {
    id: "google",
    name: "Google",
    hint: "The best results, and the most collected about you.",
    host: "google.com",
    color: "#4285f4",
  },
  {
    id: "bing",
    name: "Bing",
    hint: "Microsoft's index, behind most of the others on this list.",
    host: "bing.com",
    color: "#008373",
  },
];

export function getSearchEngine(id: string): SearchEngine | undefined {
  return searchEngines.find((engine) => engine.id === id);
}
