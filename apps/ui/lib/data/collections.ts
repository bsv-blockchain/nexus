/**
 * table: app_collections — the cards beside the App Store.
 *
 * Two kinds, in two sections. The setups are the first run's presets, built
 * from {@link file://./presets.ts} rather than written out again: the column
 * used to carry its own personas — Consumer, Knowledge Worker, Creator — which
 * were the same idea as the presets and had drifted from them, so there was no
 * way to tell which of the two a workspace had been set up with. The catalogues
 * are repositories, built from {@link file://./repositories.ts} for the same
 * reason: a card naming a source in its own words would be a second name for
 * it.
 *
 * Essentials belongs to neither and is the exception. It is what every install
 * gets whatever was picked, which is why its switch is shown on and cannot be
 * turned off.
 */
import { hubApps } from "./hub-apps";
import { ALWAYS_APPS, presets, SHARED_SINGLES, type PresetId } from "./presets";
import { defaultRepositories } from "./repositories";
import type { AppCollection, CollectionId, HubAppSlug } from "./types";

/**
 * Every preset id is a collection id.
 *
 * A compile-time assertion rather than a comment: `CollectionId` is spelled out
 * in types.ts to keep that module free of an import cycle, so this is what
 * stops the two from drifting when a fifth preset is added.
 */
const _presetsAreCollections: readonly CollectionId[] = presets.map(
  (preset): PresetId => preset.id
);
void _presetsAreCollections;

/**
 * The frame each clip rests on, and where in it to look.
 *
 * Chosen by eye against the card's real crop — a 256x96 slot cut out of a
 * 406x720 portrait clip, which is a fifth of the frame — rather than by taking
 * the first frame, which is what a `<video>` shows by default and is an
 * establishing shot in all four. Times are seconds into the clip; the poster
 * was cut from exactly that moment, so the still and the paused video agree.
 *
 * `focus` is per clip because the subject sits at a different height in each.
 * One value for all four put the reader's head above the slot and the gamer's
 * below it, and a value that merely got the eyes in still cut the mouth off.
 *
 * The Gamer clip is filmed from behind and has no face in it at any point. Its
 * pick is the frame where the person reads most clearly as a person: the lit
 * headset against the rig.
 */
const STILLS: Record<
  PresetId,
  { poster: string; posterAt: number; focus: number }
> = {
  thinker: {
    poster: "/first-run/presets/posters/thinker.jpg",
    posterAt: 3.75,
    focus: 0.26,
  },
  maker: {
    poster: "/first-run/presets/posters/maker.jpg",
    posterAt: 11.29,
    focus: 0.4,
  },
  developer: {
    poster: "/first-run/presets/posters/developer.jpg",
    posterAt: 6.38,
    focus: 0.35,
  },
  gamer: {
    poster: "/first-run/presets/posters/gamer.jpg",
    posterAt: 6.78,
    focus: 0.24,
  },
};

/**
 * The welcome's opening sequence, which Essentials borrows.
 *
 * `vault` first because that is the plate the opening settles on — the one
 * behind the logo when the flicker stops — so the card rests on the picture
 * somebody has already seen this app wearing. The rest follow it on hover.
 */
const OPENING_ART = [
  "/first-run/art/vault.webp",
  "/first-run/art/ferry.webp",
  "/first-run/art/fishing.webp",
  "/first-run/art/halt.webp",
  "/first-run/art/mill.webp",
  "/first-run/art/rock.webp",
  "/first-run/art/swiss.webp",
  "/first-run/art/buffalo.webp",
];

/** The sources that get a card of their own, and the art for each. */
const FEATURED: { id: CollectionId; art: string }[] = [
  { id: "repo-bsv", art: "/app-repos/bsv-association.jpg" },
  { id: "repo-handcash", art: "/app-repos/handcash.jpg" },
  { id: "repo-1sat", art: "/app-repos/open-protocol-labs.jpg" },
];

/** What a source is currently serving, so a card can say how much that is. */
function appsFromRepo(id: CollectionId): HubAppSlug[] {
  return hubApps.filter((app) => app.repoId === id).map((app) => app.slug);
}

export const appCollections: AppCollection[] = [
  {
    id: "essentials",
    kind: "always",
    name: "Essentials",
    description: "The apps every setup gets, whatever else you pick.",
    icon: "Star",
    apps: [...ALWAYS_APPS],
    locked: true,
    poster: OPENING_ART[0]!,
    stills: OPENING_ART,
    focus: 0.4,
  },
  ...presets.map(
    (preset): AppCollection => ({
      id: preset.id,
      kind: "preset",
      name: preset.title,
      description: preset.blurb,
      icon: "Sparkles",
      /* What this preset adds on top of the essentials: its own folder, plus
         the singles every preset brings. Not the essentials themselves — the
         card above already stands for those, and repeating them in all four
         would make every preset look like it installs the whole app list. */
      apps: [...preset.group.apps, ...SHARED_SINGLES],
      video: preset.video,
      ...STILLS[preset.id],
    })
  ),
  ...FEATURED.map(({ id, art }): AppCollection => {
    const repo = defaultRepositories.find((entry) => entry.id === id);
    return {
      id,
      kind: "repository",
      name: repo?.name ?? id,
      /* The repository's own note rather than a second description of it. */
      ...(repo?.note ? { note: repo.note } : {}),
      description: repo?.note ?? "",
      icon: "Globe",
      apps: appsFromRepo(id),
      /* Cropped to the card's shape already, so there is no `focus` to pick:
         these are brand banners made for a wide slot rather than portrait
         footage being squeezed into one. */
      poster: art,
    };
  }),
];

/**
 * The preset a collection id stands for, or null when it stands for none.
 *
 * A function rather than a cast, because the union also holds "all",
 * "essentials" and the repository ids, and only the four presets may be handed
 * to the preset machinery. Checked against the live preset list, so removing a
 * preset from the build makes this return null instead of naming something
 * gone.
 */
export function isPresetCollection(id: CollectionId): PresetId | null {
  const match = presets.find((preset) => preset.id === id);
  return match ? match.id : null;
}
