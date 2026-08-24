import { content, type AppDeveloper } from "@/lib/data";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

const DEV_LABEL: Record<AppDeveloper, string> = {
  nexus: content.appStore.devNexus,
  "bsv-association": content.appStore.devBsvAssociation,
  "open-protocol-labs": content.appStore.devOpl,
  handcash: content.appStore.devHandcash,
  "third-party": content.appStore.devThirdParty,
};

/**
 * Who we vouch for.
 *
 * Us and the association, and nobody else. A blue check on a third party would
 * be us saying we stand behind software we did not write and do not review,
 * which is the one claim this mark must never make by accident.
 */
const VOUCHED: AppDeveloper[] = ["nexus", "bsv-association"];

/**
 * The vouched-for check, on its own.
 *
 * Shared so the one in the footer is the same object as the one on a store card
 * rather than a second hand-rolled circle that drifts a shade off. `#1d9bf0` is
 * fixed rather than tokenised: this mark is recognised by its colour, and a
 * theme that re-tinted it would be claiming something else.
 *
 * `tone="known"` is the same shape in the foreground colour, for a publisher
 * who is a real named organisation but not one we vouch for. Deliberately not
 * blue and deliberately not nothing: the shape says we know who this is, the
 * colour says that is all we are saying.
 */
export function VerifiedCheck({
  tone = "vouched",
  className = "",
}: {
  tone?: "vouched" | "known";
  className?: string;
}): ReactNode {
  const vouched = tone === "vouched";
  return (
    <span
      className={`flex size-3.5 shrink-0 items-center justify-center rounded-full ${
        vouched ? "bg-[#1d9bf0]" : "bg-foreground"
      } ${className}`}
      aria-hidden="true"
    >
      <Check
        className={`size-2.5 ${vouched ? "text-white" : "text-background"}`}
        strokeWidth={3.5}
      />
    </span>
  );
}

/**
 * Who publishes an app, and how much anybody has said about them.
 *
 * Three states, not two. Blue is a vouch, and it belongs to us and the
 * association. The same check in the foreground colour is a named third party —
 * Open Protocol Labs publishes real software under its own name, and giving it
 * the blue mark would put our word behind code we do not review. A hollow ring
 * is for a publisher nobody has named at all: the absence is the point, and an
 * empty space reads as an oversight instead of a statement.
 */
export function DevBadge({
  developer,
  className = "",
}: {
  developer: AppDeveloper;
  className?: string;
}): ReactNode {
  const named = developer !== "third-party";
  return (
    <p
      className={`text-muted-foreground flex items-center gap-1 text-xs font-medium ${className}`}
    >
      {/* Nothing at all for a third party. The empty ring was meant to say
          "unverified", and instead read as a check that had failed to load —
          the absence of a mark already says everything the ring did. */}
      {named && (
        <VerifiedCheck
          tone={VOUCHED.includes(developer) ? "vouched" : "known"}
        />
      )}
      {DEV_LABEL[developer]}
    </p>
  );
}
