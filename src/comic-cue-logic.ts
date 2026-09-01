export type ComicCueKind = "!" | "?" | "..." | "panicDrops" | "sweatFace" | "gloom";

export interface ComicCueSpec {
  actorId: "player" | string;
  kind: ComicCueKind;
}

export function shouldDisplayDialogText(line?: { comicCue?: ComicCueSpec | null } | null) {
  return !line?.comicCue;
}
