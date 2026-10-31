import { uiText } from "../text/index";
import { lockCredentials, openCredentialSecurity, useCredentialSecurity } from "../data/credentialSecurity";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ClipboardClock,
  Columns3,
  Database,
  EyeOff,
  KeyRound,
  Minus,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Shield,
  Sparkles,
  ZoomIn,
} from "lucide-react";
import { ICONS } from "../data/assets";
import { Glass, SharedMinorPlane } from "../glass/Glass";
import { useScrollEdgeMorph } from "../glass/scrollEdgeMorph";
import {
  DEFAULT_ACCENT,
  CLIPBOARD_CLEAR,
  PRIVACY_CHARS,
  settingsStore,
  DEFAULT_SETTINGS,
  nearestUiScale,
  UI_SCALE_STEPS,
  useSettings,
} from "../data/settingsStore";
import { dialogs, useOpenDialog } from "./appActions";
import { checkForUpdates } from "./AppUpdates";
import { showError } from "./toasts";
import { LiquidTabs, type LiquidTab } from "./primitives/LiquidTabs";
import { LiquidToggleSwitch } from "./primitives/LiquidToggleSwitch";
import { Dialog } from "./primitives/Dialog";

type Tab = "visuals" | "data" | "misc";

const TABS: readonly LiquidTab<Tab>[] = [
  { value: "visuals", label: uiText("settings.tabs.visuals"), icon: <Palette size={15} strokeWidth={2.1} /> },
  { value: "data", label: uiText("settings.tabs.data"), icon: <Database size={15} strokeWidth={2.1} /> },
  { value: "misc", label: uiText("settings.tabs.misc"), icon: <Settings2 size={15} strokeWidth={2.1} /> },
];

/**
 * Settings, built on TaskMap's settings patterns: a portrait Major glass dialog with TaskMap's liquid
 * tabs on top and Minor glass islands holding rows (muted icon, label, description, control on the
 * right). Each tab starts at the top of its own scrolling content.
 */
export function SettingsDialog() {
  const open = useOpenDialog()?.kind === "settings";
  const [tab, setTab] = useState<Tab>("visuals");

  useLayoutEffect(() => {
    if (open) setTab("visuals");
  }, [open]);

  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("common.settings")} className="settings" keepMounted>
      <LiquidTabs label={uiText("settings.tabs.accessibleLabel")} className="settings-tabs" tabs={TABS} value={tab} onChange={setTab} />
      <SettingsBody key={tab}>
        {tab === "visuals" && <VisualsTab />}
        {tab === "data" && <DataTab />}
        {tab === "misc" && <MiscTab />}
      </SettingsBody>
      <div className="settings-footer">{uiText("settings.footer.author")}</div>
    </Dialog>
  );
}

/** The scrolling tab content; its islands morph at the scroll edges, as in TaskMap. */
function SettingsBody({ children }: { readonly children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  useScrollEdgeMorph(bodyRef, stageRef, contentRef, spacerRef, planeRef, ".settings-island");
  return (
    <div className="settings-scroll-frame">
      <div ref={planeRef} className="settings-island-plane" data-glass-plane="" aria-hidden="true">
        <span className="settings-plane-pre" data-filter-layer="" />
        <span className="settings-plane-blur" data-filter-layer="" />
      </div>
      <div ref={bodyRef} className="settings-body">
        <div ref={stageRef} className="settings-stage">
          <div ref={contentRef} className="settings-content">
            <SharedMinorPlane.Provider value>{children}</SharedMinorPlane.Provider>
          </div>
        </div>
        <div ref={spacerRef} aria-hidden="true" />
      </div>
    </div>
  );
}

/* ---------- Tabs ---------- */

function VisualsTab() {
  const showCredentialButtons = useSettings((settings) => settings.showCredentialButtons);
  const showCurrency = useSettings((settings) => settings.showCurrency);
  const showSixV6 = useSettings((settings) => settings.showSixV6);
  const zoom = useSettings((settings) => settings.uiScale);

  return (
    <div className="settings-stack">
      <Island heading={uiText("settings.sections.columns")} icon={<Columns3 size={14} strokeWidth={2.2} />}>
        <ToggleRow
          icon={<KeyRound size={17} strokeWidth={2.2} />}
          label={uiText("settings.credentialButtons.label")}
          description={uiText("settings.credentialButtons.description")}
          checked={showCredentialButtons}
          onChange={(checked) => settingsStore.set({ showCredentialButtons: checked })}
        />
        <ToggleRow
          icon={<img src={ICONS.overwatchCoins} alt="" className="settings-row-img settings-row-img-coins" />}
          label={uiText("settings.currency.label")}
          description={uiText("settings.currency.description")}
          checked={showCurrency}
          onChange={(checked) => settingsStore.set({ showCurrency: checked })}
        />
        <ToggleRow
          icon={<img src={ICONS.flex} alt="" className="settings-row-img" />}
          label={uiText("settings.sixVersusSix.label")}
          description={uiText("settings.sixVersusSix.description")}
          checked={showSixV6}
          onChange={(checked) => settingsStore.set({ showSixV6: checked })}
        />
      </Island>

      <Island>
        <Row icon={<ZoomIn size={17} strokeWidth={2.2} />} label={uiText("settings.uiScale.label")} />
        <div className="settings-chips">
          {UI_SCALE_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className="settings-chip"
              aria-pressed={nearestUiScale(zoom) === step}
              onClick={() => settingsStore.set({ uiScale: step })}
            >
              {Math.round(step * 100)}{uiText("settings.uiScale.percent")}{step === DEFAULT_SETTINGS.uiScale && <span className="settings-chip-note">{uiText("common.default")}</span>}
            </button>
          ))}
        </div>
      </Island>

      <AppearanceIsland />
    </div>
  );
}

function AppearanceIsland() {
  const accentColor = useSettings((settings) => settings.accentColor);
  const badgeEffects = useSettings((settings) => settings.badgeEffects);
  const shown = accentColor ?? DEFAULT_ACCENT;
  return (
    <Island>
      <Row
        icon={<Palette size={17} strokeWidth={2.2} />}
        label={uiText("settings.accentColour.label")}
        description={uiText("settings.accentColour.description")}
        control={
          <span className="settings-color">
            <input
              type="color"
              value={shown}
              aria-label={uiText("settings.accentColour.label")}
              onChange={(event) => settingsStore.set({ accentColor: event.target.value })}
            />
            <span className="settings-color-value">{shown}</span>
            <button
              type="button"
              className="settings-color-reset"
              title={uiText("settings.accentColour.resetTooltip")}
              aria-label={uiText("settings.accentColour.resetAccessibleLabel")}
              data-hidden={accentColor === null || undefined}
              onClick={() => settingsStore.set({ accentColor: null })}
            >
              <RotateCcw size={13} strokeWidth={2.3} />
            </button>
          </span>
        }
      />
      <ToggleRow
        icon={<Sparkles size={17} strokeWidth={2.2} />}
        label={uiText("settings.rankEffects.label")}
        description={uiText("settings.rankEffects.description")}
        checked={badgeEffects}
        onChange={(checked) => settingsStore.set({ badgeEffects: checked })}
      />
    </Island>
  );
}

function DataTab() {
  const security = useCredentialSecurity();

  return (
    <div className="settings-stack">
      <Island heading={uiText("settings.sections.credentialProtection")} icon={<Shield size={14} strokeWidth={2.2} />}>
        <Row icon={<KeyRound size={17} strokeWidth={2.2} />} label={security?.mode === "plain" ? uiText("settings.encryption.status.plain") : security?.locked ? uiText("settings.encryption.status.locked") : uiText("settings.encryption.status.unlocked")}
          description={!security ? uiText("settings.encryption.status.loading")
            : security.mode === "plain" ? uiText("settings.encryption.description.plain")
            : uiText("settings.encryption.description.protected")} />
        {security && <div className="credential-security-actions">
          {security.mode !== "password" ? <button type="button" className="settings-button" onClick={() => openCredentialSecurity("enable")}>{uiText("settings.encryption.actions.enable")}</button> : <>
            <button type="button" className="settings-button" onClick={() => security.locked ? openCredentialSecurity("unlock") : void lockCredentials().catch((error) => showError(uiText("settings.encryption.lockFailed"), error))}>
              {security.locked ? uiText("settings.encryption.actions.unlock") : uiText("settings.encryption.actions.lock")}
            </button>
            <button type="button" className="settings-button" onClick={() => openCredentialSecurity("change")}>{uiText("settings.encryption.actions.changePassword")}</button>
          </>}
          {security.mode !== "plain" && <button type="button" className="settings-button" onClick={() => openCredentialSecurity("disable")}>{uiText("settings.encryption.actions.disable")}</button>}
        </div>}
      </Island>
      <Island>
        <Row
          icon={<RotateCcw size={17} strokeWidth={2.2} />}
          label={uiText("settings.rankReset.label")}
          description={uiText("settings.rankReset.description")}
          control={
            <button type="button" className="settings-button" onClick={() => dialogs.open({ kind: "season-reset" })}>
              {uiText("settings.rankReset.action")}
            </button>
          }
        />
      </Island>
    </div>
  );
}

function MiscTab() {
  const privacyMode = useSettings((settings) => settings.privacyMode);
  const privacyChars = useSettings((settings) => settings.privacyChars);
  const setChars = (value: number) =>
    settingsStore.set({ privacyChars: Math.min(PRIVACY_CHARS.max, Math.max(PRIVACY_CHARS.min, value)) });
  const clearSeconds = useSettings((settings) => settings.clipboardClearSeconds);
  const discordPresence = useSettings((settings) => settings.discordPresence);
  // 5, 10, … 30 seconds, then never (null).
  const clearSteps: readonly (number | null)[] = [
    ...Array.from(
      { length: (CLIPBOARD_CLEAR.max - CLIPBOARD_CLEAR.min) / CLIPBOARD_CLEAR.step + 1 },
      (_, index) => CLIPBOARD_CLEAR.min + index * CLIPBOARD_CLEAR.step,
    ),
    null,
  ];
  const clearIndex = Math.max(0, clearSteps.indexOf(clearSeconds));
  const stepClear = (direction: number) => {
    const next = clearIndex + direction;
    // `null` (never) is a real step, so bounds are checked by index.
    if (next >= 0 && next < clearSteps.length) settingsStore.set({ clipboardClearSeconds: clearSteps[next] ?? null });
  };

  return (
    <div className="settings-stack settings-stack-fill">
      <Island heading={uiText("settings.sections.privacy")} icon={<Shield size={14} strokeWidth={2.2} />}>
        <ToggleRow
          icon={<EyeOff size={17} strokeWidth={2.2} />}
          label={uiText("settings.privacyMode.label")}
          description={uiText("settings.privacyMode.description")}
          checked={privacyMode}
          onChange={(checked) => settingsStore.set({ privacyMode: checked })}
        />
        <Row
          icon={<Shield size={17} strokeWidth={2.2} />}
          label={uiText("settings.visibleCharacters.label")}
          description={uiText("settings.visibleCharacters.description")}
          disabled={!privacyMode}
          control={
            <Stepper
              value={privacyChars === 0 ? uiText("settings.visibleCharacters.hidden") : String(privacyChars)}
              decrementLabel={uiText("settings.visibleCharacters.decrease")}
              incrementLabel={uiText("settings.visibleCharacters.increase")}
              canDecrement={privacyMode && privacyChars > PRIVACY_CHARS.min}
              canIncrement={privacyMode && privacyChars < PRIVACY_CHARS.max}
              onDecrement={() => setChars(privacyChars - 1)}
              onIncrement={() => setChars(privacyChars + 1)}
            />
          }
        />
      </Island>
      <Island>
        <Row
          icon={<ClipboardClock size={17} strokeWidth={2.2} />}
          label={uiText("settings.clipboard.label")}
          description={uiText("settings.clipboard.description")}
          control={
            <Stepper
              value={clearSeconds === null ? uiText("common.never") : uiText("settings.clipboard.duration", { seconds: clearSeconds })}
              decrementLabel={uiText("settings.clipboard.decrease")}
              incrementLabel={uiText("settings.clipboard.increase")}
              canDecrement={clearIndex > 0}
              canIncrement={clearIndex < clearSteps.length - 1}
              onDecrement={() => stepClear(-1)}
              onIncrement={() => stepClear(1)}
            />
          }
        />
      </Island>
      <Island>
        <ToggleRow
          icon={<DiscordIcon size={17} />}
          label={uiText("settings.discordPresence.label")}
          description={uiText("settings.discordPresence.description")}
          checked={discordPresence}
          onChange={(checked) => settingsStore.set({ discordPresence: checked })}
        />
      </Island>
      <span className="settings-spacer" />
      <div className="settings-pair">
        <button type="button" className="settings-button" onClick={() => void checkForUpdates(false)}>
          <RefreshCw size={15} strokeWidth={2.2} />{uiText("settings.updates.check")}</button>
        <button type="button" className="settings-button" onClick={() => dialogs.open({ kind: "whats-new" })}>
          <Sparkles size={15} strokeWidth={2.2} />{uiText("settings.updates.whatsNew")}</button>
      </div>
    </div>
  );
}

/* ---------- Building blocks (TaskMap settings patterns) ---------- */

/** A Minor glass group on the Major shell (TaskMap SettingsIsland). */
function Island({
  heading,
  icon,
  soon,
  children,
}: {
  /** Without one the island is just its rows (e.g. UI scale). */
  readonly heading?: string;
  readonly icon?: ReactNode;
  readonly soon?: boolean;
  readonly children: ReactNode;
}) {
  return (
    // Live: its rim is redrawn at the visible slice while it morphs at the scroll edges.
    <Glass role="minor" live className="settings-island">
      <div className="settings-island-content" data-slice-content="">
        {heading && (
          <div className="settings-island-head">
            <span className="settings-island-icon">{icon}</span>
            {heading}
            {soon && <span className="settings-soon">{uiText("settings.soon")}</span>}
          </div>
        )}
        <div className="settings-island-rows">{children}</div>
      </div>
    </Glass>
  );
}

function Row({
  icon,
  label,
  description,
  control,
  disabled,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly description?: string;
  readonly control?: ReactNode;
  readonly disabled?: boolean;
}) {
  return (
    <div className="settings-row" data-disabled={disabled || undefined}>
      <span className="settings-row-leading">{icon}</span>
      <span className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {description && <span className="settings-row-description">{description}</span>}
      </span>
      {control && <span className="settings-row-control">{control}</span>}
    </div>
  );
}

/** The whole row toggles, like TaskMap's SettingsToggleRow, with its liquid switch. */
function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <div className="settings-row settings-toggle-row" onClick={() => onChange(!checked)}>
      <span className="settings-row-leading">{icon}</span>
      <span className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {description && <span className="settings-row-description">{description}</span>}
      </span>
      <span className="settings-row-control">
        <LiquidToggleSwitch checked={checked} label={label} onCheckedChange={onChange} />
      </span>
    </div>
  );
}

function Stepper({
  value,
  decrementLabel,
  incrementLabel,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
}: {
  readonly value: string;
  readonly decrementLabel: string;
  readonly incrementLabel: string;
  readonly canDecrement: boolean;
  readonly canIncrement: boolean;
  readonly onDecrement: () => void;
  readonly onIncrement: () => void;
}) {
  return (
    <span className="settings-stepper">
      <button
        type="button"
        className="settings-step"
        aria-label={decrementLabel}
        disabled={!canDecrement}
        onClick={onDecrement}
      >
        <Minus size={14} strokeWidth={2.4} />
      </button>
      <span className="settings-step-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="settings-step"
        aria-label={incrementLabel}
        disabled={!canIncrement}
        onClick={onIncrement}
      >
        <Plus size={14} strokeWidth={2.4} />
      </button>
    </span>
  );
}

function DiscordIcon({ size }: { readonly size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.36 2.8a13.82 13.82 0 0 0-.63 1.3 18.27 18.27 0 0 0-5.46 0 13.82 13.82 0 0 0-.64-1.3 19.73 19.73 0 0 0-4.95 1.57C.55 9.09-.3 13.7.13 18.25a19.9 19.9 0 0 0 6.08 3.07 14.8 14.8 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.08 0c.16.13.33.26.5.38-.65.38-1.34.71-2.06.98.38.74.82 1.44 1.3 2.1a19.86 19.86 0 0 0 6.09-3.07c.5-5.27-.84-9.84-3.55-13.88ZM8.02 15.45c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.96 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.2 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Z" />
    </svg>
  );
}
