import { uiText, rankName } from "../text/index";
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { sameRank, type Rank, type RankTier } from "../data/accounts";
import { RANK_IMAGES } from "../data/assets";

/**
 * Effects that reward high ranks, weaker the lower the rank (styles: `.badge-fx`, per tier): a glow
 * on the emblem (Emerald up), a shine now and then (Diamond up) and sparkles (Grandmaster, more
 * on Champion). Here only the sparkle counts; colours, strengths and timing live in the CSS.
 */
const SPARKLES: Partial<Record<RankTier, number>> = { Champion: 7, Grandmaster: 3 };
const EFFECT_TIERS: ReadonlySet<RankTier> = new Set(["Champion", "Grandmaster", "Master", "Diamond", "Emerald"]);
/** Sparkle spots around the badge (left %, top %, size as a share of the badge height, delay s). */
const SPOTS = [
  [8, 6, 0.22, 0],
  [40, 92, 0.17, 1.1],
  [95, 10, 0.2, 2],
  [24, -6, 0.15, 0.6],
  [66, 98, 0.15, 1.6],
  [2, 70, 0.17, 2.5],
  [58, -8, 0.17, 0.3],
] as const;

const stateOf = (rank: Rank) => (rank.tier === "Unranked" ? "unranked" : rank.predicted ? "predicted" : "ranked");

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
  // Each badge starts its loops at its own point, so a list of them never pulses in step.
  const [phase] = useState(() => Math.random());

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
          className="badge-fx"
          data-tier={rank.tier}
          style={{ "--badge-mask": `url("${RANK_IMAGES[rank.tier]}")`, "--fx-phase": phase } as CSSProperties}
          aria-hidden="true"
        >
          <span className="fx-glow" />
          {rank.tier !== "Emerald" && <span className="fx-glint" />}
          {SPOTS.slice(0, SPARKLES[rank.tier] ?? 0).map(([left, top, size, delay], index) => (
            <span
              key={index}
              className="fx-sparkle"
              style={{ left: `${left}%`, top: `${top}%`, "--size": size, "--delay": `${delay}s` } as CSSProperties}
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
