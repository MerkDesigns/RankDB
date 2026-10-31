import { uiText } from "../text/index";
import { ICONS, ROLE_ICONS, VALUE_A_ICONS, VALUE_B_ICONS } from "../data/assets";
import { Glass } from "../glass/Glass";
import { useLab } from "../lab/store";
import { dragRegion } from "../platform/window";
import { ChevronDown } from "lucide-react";
import { cycleRoleSort, useRoleSort, type RankSlot } from "../data/rosterStore";
import { captureRowPositions } from "./sortMotion";
import { useAppActions } from "./appActions";

const ROLE_LABELS = [uiText("header.tank"), uiText("header.damage"), uiText("header.support")];

export function Header() {
  const chrome = useLab((state) => state.chrome);
  const accountCount = useLab((state) => state.accountCount);
  const drag = dragRegion(chrome);
  const actions = useAppActions();
  return (
    <header className="header" {...drag}>
      <Glass role="major" className="island island-actions">
        <img className="ow-logo" src={ICONS.overwatch} alt={uiText("common.rankdb")} draggable={false} />
        {chrome === "rail" ? (
          <>
            <span className="wordmark">{uiText("common.rankdb")}</span>
            <span className="island-spacer" {...drag} />
            <span className="island-meta">{accountCount}{uiText("header.accounts")}</span>
          </>
        ) : (
          <>
            <span className="island-spacer" {...drag} />
            {actions.map(({ key, title, Icon, active, glow, onClick }) => (
              <button
                key={key}
                type="button"
                className="icon-button"
                title={title}
                aria-label={title}
                data-active={active || undefined}
                data-glow={glow || undefined}
                onClick={onClick}
              >
                <Icon size={19} strokeWidth={2.2} />
              </button>
            ))}
          </>
        )}
      </Glass>
      <Glass role="major" className="island island-roles">
        {ROLE_ICONS.map((icon, index) => (
          <SortButton key={index} slot={index as 0 | 1 | 2} label={ROLE_LABELS[index]!} icon={icon} />
        ))}
      </Glass>
      <Glass role="major" className="island island-flex">
        <SortButton slot="sixV6" label={uiText("header.sixVersusSix")} icon={ICONS.flex} />
      </Glass>
      <Glass role="major" className="island island-values-a">
        {VALUE_A_ICONS.map((icon, index) => (
          <img key={index} className="header-icon" src={icon} alt="" draggable={false} />
        ))}
      </Glass>
      <Glass role="major" className="island island-values-b">
        {VALUE_B_ICONS.map((icon, index) => (
          <img key={index} className="header-icon" src={icon} alt="" draggable={false} />
        ))}
      </Glass>
    </header>
  );
}

/**
 * A rank column's icon: a click sorts every account by that rank, best first (groups set aside);
 * a second click goes back to your order. Sorting is temporary and never saved.
 */
function SortButton({ slot, label, icon }: { readonly slot: RankSlot; readonly label: string; readonly icon: string }) {
  const active = useRoleSort()?.slot === slot;
  return (
    <button
      type="button"
      className="role-sort"
      aria-pressed={active}
      data-active={active || undefined}
      onClick={() => {
        captureRowPositions();
        cycleRoleSort(slot);
      }}
    >
      {/* Sorted by this role: a chevron on each side of its icon, as in the old app. */}
      {active && <ChevronDown className="role-sort-arrow" data-side="left" size={14} strokeWidth={2.35} aria-hidden="true" />}
      <img src={icon} alt={label} draggable={false} />
      {active && <ChevronDown className="role-sort-arrow" data-side="right" size={14} strokeWidth={2.35} aria-hidden="true" />}
    </button>
  );
}
