import { uiText } from "../text/index";
import { ICONS, ROLE_ICONS, VALUE_A_ICONS, VALUE_B_ICONS } from "../data/assets";
import { Glass } from "../glass/Glass";
import { useLab } from "../lab/store";
import { dragRegion } from "../platform/window";
import { ChevronDown } from "lucide-react";
import { cycleColumnSort, useColumnSort, type CurrencyColumn, type SortColumn } from "../data/rosterStore";
import { captureRowPositions } from "./sortMotion";
import { useAppActions } from "./appActions";

const ROLE_LABELS = [uiText("header.tank"), uiText("header.damage"), uiText("header.support")];
const VALUE_A_COLUMNS: readonly CurrencyColumn[] = ["prisms", "coins", "credits"];
const VALUE_B_COLUMNS: readonly CurrencyColumn[] = ["competitive", "legacy"];
const CURRENCY_LABELS: Readonly<Record<CurrencyColumn, string>> = {
  prisms: uiText("header.currencies.prisms"),
  coins: uiText("header.currencies.coins"),
  credits: uiText("header.currencies.credits"),
  competitive: uiText("header.currencies.competitive"),
  legacy: uiText("header.currencies.legacy"),
};

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
                <span className="button-icon">
                  <Icon size={19} strokeWidth={2.2} />
                </span>
              </button>
            ))}
          </>
        )}
        <GlassLight />
      </Glass>
      <Glass role="major" className="island island-roles">
        {ROLE_ICONS.map((icon, index) => (
          <SortButton key={index} column={index as 0 | 1 | 2} label={ROLE_LABELS[index]!} icon={icon} />
        ))}
        <GlassLight />
      </Glass>
      <Glass role="major" className="island island-flex">
        <SortButton column="sixV6" label={uiText("header.sixVersusSix")} icon={ICONS.flex} />
        <GlassLight />
      </Glass>
      <Glass role="major" className="island island-values-a">
        {VALUE_A_ICONS.map((icon, index) => (
          <SortButton key={index} column={VALUE_A_COLUMNS[index]!} label={CURRENCY_LABELS[VALUE_A_COLUMNS[index]!]} icon={icon} />
        ))}
        <GlassLight />
      </Glass>
      <Glass role="major" className="island island-values-b">
        {VALUE_B_ICONS.map((icon, index) => (
          <SortButton key={index} column={VALUE_B_COLUMNS[index]!} label={CURRENCY_LABELS[VALUE_B_COLUMNS[index]!]} icon={icon} />
        ))}
        <GlassLight />
      </Glass>
    </header>
  );
}

/** The light following the pointer over a glass bar (app.css `.glass-light`, ui/pointerGlow.ts). */
export function GlassLight() {
  return <span className="glass-light" aria-hidden="true" />;
}

/**
 * A rank or currency column's icon: a click sorts every account by that rank (best first) or
 * currency (most first), groups set aside; a second click goes back to your order. Sorting is
 * temporary and never saved.
 */
function SortButton({ column, label, icon }: { readonly column: SortColumn; readonly label: string; readonly icon: string }) {
  const active = useColumnSort()?.column === column;
  return (
    <button
      type="button"
      className="role-sort"
      aria-pressed={active}
      data-active={active || undefined}
      onClick={() => {
        captureRowPositions();
        cycleColumnSort(column);
      }}
    >
      {/* Sorted by this column: a chevron on each side of its icon, as in the old app. */}
      <span className="role-sort-icon">
        {active && <ChevronDown className="role-sort-arrow" data-side="left" size={14} strokeWidth={2.35} aria-hidden="true" />}
        <img src={icon} alt={label} draggable={false} />
        {active && <ChevronDown className="role-sort-arrow" data-side="right" size={14} strokeWidth={2.35} aria-hidden="true" />}
      </span>
    </button>
  );
}
