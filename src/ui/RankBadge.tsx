import { uiText, rankName } from "../text/index";
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { sameRank, type Rank } from "../data/accounts";
import { RANK_IMAGES } from "../data/assets";
import { EFFECT_TIERS, SPARKLES, SPOTS, useRankEffects } from "./rankEffects";

const stateOf = (rank: Rank) => (rank.tier === "Unranked" ? "unranked" : rank.predicted ? "predicted" : "ranked");

/**
 * A rank's badge. Real ranks from Emerald up carry effects, weaker the lower the rank: a glow on
 * the emblem (Emerald up), a shine now and then (Diamond up) and sparkles (Grandmaster, more on
 * Champion). Which tier gets what, and the motion, are in rankEffects.ts; colours and strengths in
 * app.css (`.badge-fx`).
 */
export const RankBadge = memo(function RankBadge({
  rank,
  onPick,
  editing = false,
}: {
  readonly rank: Rank;
  /** Opens the rank picker for this badge; without it the badge only shows the rank. */
  readonly onPick?: (badge: HTMLElement) => void;
  /** The rank picker is open for it: lifted a little, and changes animate. */
  readonly editing?: boolean;
}) {
  // A change made in the picker (or handed back when it closes) cross-fades from the old badge
  // with a shine across the new one, instead of swapping at once. `changes` keys the animations.
  const [shown, setShown] = useState(rank);
  const [changes, setChanges] = useState(0);
  const [previous, setPrevious] = useState<Rank | null>(null);
  const wasEditing = useRef(editing);
  if (!sameRank(shown, rank)) {
    setShown(rank);
    // Placements change the accessible label/save state, but not the badge's appearance.
    const appearanceChanged = shown.tier !== rank.tier || shown.division !== rank.division || shown.predicted !== rank.predicted;
    if (appearanceChanged && (editing || wasEditing.current)) {
      setPrevious(shown);
      setChanges((count) => count + 1);
    }
  }
  useEffect(() => {
    wasEditing.current = editing;
  });
  const effects = useRankEffects(rank.tier, editing);

  const state = stateOf(rank);
  const label =
    rank.tier === "Unranked"
      ? rankName(rank.tier)
      : uiText("rankBadge.rankLabel", { rank: rankName(rank.tier), division: rank.division, prediction: rank.predicted ? uiText("rankBadge.predictionSuffix", { placements: rank.placements }) : "" });
  return (
    <button
      type="button"
      className="badge"
      data-state={state}
      data-editing={editing || undefined}
      aria-label={onPick ? uiText("rankBadge.editableAccessibleLabel", { label: label }) : label}
      data-static={onPick ? undefined : ""}
      onClick={(event) => onPick?.(event.currentTarget)}
    >
      <img key={changes} className={changes ? "badge-in" : undefined} src={RANK_IMAGES[rank.tier]} alt="" draggable={false} />
      {previous && (
        <img
          key={`out-${changes}`}
          className="badge-out"
          data-state={stateOf(previous)}
          src={RANK_IMAGES[previous.tier]}
          alt=""
          draggable={false}
        />
      )}
      {state === "ranked" && EFFECT_TIERS.has(rank.tier) && (
        <span
          ref={effects}
          className="badge-fx"
          data-tier={rank.tier}
          style={{ "--badge-mask": `url("${RANK_IMAGES[rank.tier]}")` } as CSSProperties}
          aria-hidden="true"
        >
          <span className="fx-glow" />
          {rank.tier !== "Emerald" && <span className="fx-glint" />}
          {SPOTS.slice(0, SPARKLES[rank.tier] ?? 0).map(([left, top, size], index) => (
            <span
              key={index}
              className="fx-sparkle"
              style={{ left: `${left}%`, top: `${top}%`, "--size": size } as CSSProperties}
            />
          ))}
        </span>
      )}
      {rank.tier !== "Unranked" && (
        <span key={`number-${changes}`} className={changes ? "badge-number badge-in" : "badge-number"}>
          {rank.division}
        </span>
      )}
      {previous && (
        <span
          key={`shine-${changes}`}
          className="badge-shine"
          style={{ "--badge-mask": `url("${RANK_IMAGES[rank.tier]}")` } as CSSProperties}
          onAnimationEnd={() => setPrevious(null)}
        />
      )}
    </button>
  );
});
