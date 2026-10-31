import { Glass } from "../glass/Glass";
import { useAppActions } from "./appActions";
import { WindowControls } from "./WindowControls";

/**
 * Option 3: a glass rail down the right edge. Window buttons sit at the top, nearest the corner,
 * so the space beneath them holds the app actions instead of being empty.
 */
export function Rail() {
  const actions = useAppActions();
  return (
    <Glass role="major" className="rail">
      <WindowControls layout="column" />
      <span className="rail-divider" />
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
      <span className="rail-spacer" data-drag-region />
    </Glass>
  );
}
