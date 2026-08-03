/**
 * table: message_media — the pictures and clips shared in conversations.
 *
 * Named entries rather than inline literals so a thread and the mock uploader
 * can attach the same asset without either restating its dimensions. The sizes
 * are the real intrinsic ones: the tile reserves its box from them, so a thread
 * never reflows as media loads.
 */
import type { MediaItem } from "./types";

export const media = {
  farmWide: {
    kind: "image",
    src: "/media/farm-wide.jpg",
    width: 1600,
    height: 1067,
    alt: "Alpine pasture above a lake, farmhouses along the shore",
  },
  farmHuts: {
    kind: "image",
    src: "/media/farm-huts.jpg",
    width: 1400,
    height: 913,
    alt: "Cluster of timber farm buildings on a hillside",
  },
  farmPasture: {
    kind: "image",
    src: "/media/farm-pasture.jpg",
    width: 1400,
    height: 969,
    alt: "Flowering meadow in the foreground of a green pasture",
  },
  valleyWide: {
    kind: "image",
    src: "/media/valley-wide.jpg",
    width: 1200,
    height: 1800,
    alt: "Tall rock face above a valley floor, shot in portrait",
  },
  valleyLake: {
    kind: "image",
    src: "/media/valley-lake.jpg",
    width: 1400,
    height: 910,
    alt: "Farmhouse and lake at the base of a valley",
  },
  fieldDay: {
    kind: "video",
    src: "/media/field-day.mp4",
    poster: "/media/field-day.jpg",
    duration: 14,
    width: 1280,
    height: 720,
    alt: "Slow pan across the pasture used for the field day",
  },
  pastureWalk: {
    kind: "video",
    src: "/media/pasture-walk.mp4",
    poster: "/media/pasture-walk.jpg",
    duration: 8,
    width: 1280,
    height: 720,
    alt: "Walking clip looking up the hillside",
  },
  harvestBatch: {
    kind: "video",
    src: "/media/harvest-batch.mp4",
    poster: "/media/harvest-batch.jpg",
    duration: 23,
    width: 1280,
    height: 720,
    alt: "Tracking shot along the valley where the batch was grown",
  },
  /* ------------------------------------------------------- documents ---- */
  soilReport: {
    kind: "file",
    src: "/media/files/soil-report.pdf",
    poster: "/media/files/soil-report.jpg",
    fileName: "nutrient-density-report.pdf",
    fileSize: "21 KB",
    width: 620,
    height: 800,
    alt: "Nutrient density report, first page",
  },
  annexDraft: {
    kind: "file",
    src: "/media/files/annex-draft.docx",
    poster: "/media/files/annex-draft.jpg",
    fileName: "incentive-annex-draft-4.docx",
    fileSize: "1 KB",
    width: 620,
    height: 800,
    alt: "Incentive annex draft, first page",
  },
  brixitDeck: {
    kind: "file",
    src: "/media/files/brixit-deck.pptx",
    poster: "/media/files/brixit-deck.jpg",
    fileName: "brixit-shelf-story.pptx",
    fileSize: "2 KB",
    width: 1280,
    height: 720,
    alt: "BRIXit slide deck, title slide",
  },
  handleNotes: {
    kind: "file",
    src: "/media/files/handle-syntax.md",
    fileName: "handle-syntax.md",
    fileSize: "367 bytes",
    width: 620,
    height: 800,
    alt: "Handle syntax notes",
  },
  fieldRecording: {
    kind: "audio",
    src: "/media/files/field-recording.mp3",
    fileName: "field-day-theme.mp3",
    artist: "Marcel van Silfhout",
    fileSize: "43 KB",
    duration: 2.7,
    width: 1,
    height: 1,
    alt: "Field day theme",
  },
} satisfies Record<string, MediaItem>;

export type MediaKey = keyof typeof media;

/** The named items, in order, as an attachment list. */
export function mediaItems(...keys: MediaKey[]): MediaItem[] {
  return keys.map((key) => media[key]);
}
