import type { ReactNode } from "react";
import { ArrowRight, Check, ChevronLeft, FolderOpen, LayoutGrid, Monitor } from "lucide-react";
import { Glass } from "../glass/Glass";
import { Button } from "../ui/primitives/Button";
import { LiquidToggleSwitch } from "../ui/primitives/LiquidToggleSwitch";
import { uiText } from "../text/index";
import type { InstallFailure, InstallStage, InstallerDetails } from "./installerClient";
import { installStages, migratesOldApp, type InstallKind, type InstallOptions } from "./installerFlow";
import appIcon from "../../src-tauri/icons/128x128@2x.png";

const actionLabel = (kind: InstallKind) =>
  kind === "install"
    ? uiText("installer.actions.install")
    : kind === "update"
      ? uiText("installer.actions.update")
      : uiText("installer.actions.reinstall");

/** The app icon on the left, the screen's copy and its main action on the right. */
function Hero({ children, footer }: { readonly children: ReactNode; readonly footer?: ReactNode }) {
  return (
    <>
      <div className="installer-hero">
        <div className="installer-mark" aria-hidden="true">
          <img src={appIcon} alt="" draggable={false} />
        </div>
        <div className="installer-hero-copy">
          {children}
        </div>
      </div>
      {footer && (
        <footer className="installer-footer">
          {footer}
        </footer>
      )}
    </>
  );
}

function Page({ title, children, actions }: { readonly title: string; readonly children?: ReactNode; readonly actions?: ReactNode }) {
  return (
    <div className="installer-page">
      <h2>{title}</h2>
      {children}
      {actions && <footer className="installer-actions">{actions}</footer>}
    </div>
  );
}

function PrimaryAction({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <Button variant="primary" className="installer-primary" onClick={onClick} autoFocus>
      {label}
      <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
    </Button>
  );
}

function VersionFooter({ details, onOptions }: { readonly details: InstallerDetails; readonly onOptions: () => void }) {
  return (
    <>
      <span>{uiText("installer.version", { version: details.version })}</span>
      <Button className="installer-quiet" onClick={onOptions}>
        {uiText("installer.options")}
      </Button>
    </>
  );
}

export function WelcomeScreen({
  details,
  onInstall,
  onOptions,
}: {
  readonly details: InstallerDetails;
  readonly onInstall: () => void;
  readonly onOptions: () => void;
}) {
  return (
    <Hero footer={<VersionFooter details={details} onOptions={onOptions} />}>
      <h1>{uiText("installer.welcome.title", { product: details.productName })}</h1>
      <p className="installer-body">{uiText("installer.welcome.description")}</p>
      <PrimaryAction label={uiText("installer.actions.install")} onClick={onInstall} />
    </Hero>
  );
}

export function UpdateScreen({
  details,
  kind,
  onUpdate,
  onOptions,
}: {
  readonly details: InstallerDetails;
  readonly kind: InstallKind;
  readonly onUpdate: () => void;
  readonly onOptions: () => void;
}) {
  const product = details.productName;
  const installed = details.existing?.version ?? "";
  return (
    <Hero footer={<VersionFooter details={details} onOptions={onOptions} />}>
      <h1>
        {kind === "reinstall"
          ? uiText("installer.update.reinstallTitle", { product })
          : uiText("installer.update.title", { product })}
      </h1>
      <p className="installer-body">
        {kind === "reinstall"
          ? uiText("installer.update.reinstallDescription", { installed })
          : uiText("installer.update.description", { installed, version: details.version })}
      </p>
      <p className="installer-body">
        {migratesOldApp(details) ? uiText("installer.update.migrates") : uiText("installer.update.keepsData")}
      </p>
      <p className="installer-location" title={details.existing?.location}>
        <FolderOpen size={15} strokeWidth={1.8} aria-hidden="true" />
        <span>{details.existing?.location}</span>
      </p>
      <PrimaryAction label={actionLabel(kind)} onClick={onUpdate} />
    </Hero>
  );
}

export function NewerInstalledScreen({ details, onClose }: { readonly details: InstallerDetails; readonly onClose: () => void }) {
  return (
    <Hero>
      <h1>{uiText("installer.newer.title", { product: details.productName })}</h1>
      <p className="installer-body">
        {uiText("installer.newer.description", { installed: details.existing?.version ?? "", version: details.version })}
      </p>
      <Button variant="primary" className="installer-primary" onClick={onClose} autoFocus>
        {uiText("common.close")}
      </Button>
    </Hero>
  );
}

function OptionRow({
  icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    // Only the switch toggles, as in Settings.
    <div className="settings-row" data-disabled={disabled || undefined}>
      <span className="settings-row-leading">{icon}</span>
      <span className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
      </span>
      <span className="settings-row-control">
        <LiquidToggleSwitch checked={checked} label={label} disabled={disabled} onCheckedChange={onChange} />
      </span>
    </div>
  );
}

export function OptionsScreen({
  options,
  kind,
  onBrowse,
  onShortcut,
  onBack,
  onInstall,
}: {
  readonly options: InstallOptions;
  readonly kind: InstallKind;
  readonly onBrowse: () => void;
  readonly onShortcut: (shortcut: "startMenu" | "desktop", on: boolean) => void;
  readonly onBack: () => void;
  readonly onInstall: () => void;
}) {
  const updating = kind !== "install";
  return (
    <Page
      title={uiText("installer.optionsPage.title")}
      actions={
        <>
          <Button onClick={onBack}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            {uiText("installer.back")}
          </Button>
          <Button variant="primary" onClick={onInstall}>
            {actionLabel(kind)}
          </Button>
        </>
      }
    >
      <Glass role="minor" floating className="installer-island">
        <div className="installer-island-rows">
          <div className="settings-row" data-disabled={updating || undefined}>
            <span className="settings-row-leading">
              <FolderOpen size={18} strokeWidth={1.8} />
            </span>
            <span className="settings-row-copy">
              <span className="settings-row-label">{uiText("installer.optionsPage.location")}</span>
              <span className="settings-row-description installer-path" title={options.location}>
                {options.location}
              </span>
            </span>
            <span className="settings-row-control">
              <Button onClick={onBrowse} disabled={updating}>
                {uiText("installer.optionsPage.change")}
              </Button>
            </span>
          </div>
          <OptionRow
            icon={<LayoutGrid size={18} strokeWidth={1.8} />}
            label={uiText("installer.optionsPage.startMenu")}
            checked={options.startMenuShortcut}
            disabled={updating}
            onChange={(on) => onShortcut("startMenu", on)}
          />
          <OptionRow
            icon={<Monitor size={18} strokeWidth={1.8} />}
            label={uiText("installer.optionsPage.desktop")}
            checked={options.desktopShortcut}
            disabled={updating}
            onChange={(on) => onShortcut("desktop", on)}
          />
        </div>
      </Glass>
      {updating && <p className="installer-body">{uiText("installer.optionsPage.updateNote")}</p>}
    </Page>
  );
}

function progressTitle(kind: InstallKind, product: string) {
  if (kind === "install") return uiText("installer.progress.install", { product });
  if (kind === "update") return uiText("installer.progress.update", { product });
  return uiText("installer.progress.reinstall", { product });
}

function stageLabel(stage: InstallStage, kind: InstallKind) {
  switch (stage) {
    case "preparing":
      return uiText("installer.stages.preparing");
    case "installing":
      return uiText("installer.stages.installing");
    case "shortcuts":
      return kind === "install" ? uiText("installer.stages.shortcuts") : uiText("installer.stages.shortcutsUpdate");
    case "finishing":
      return uiText("installer.stages.finishing");
  }
}

export function InstallingScreen({
  product,
  kind,
  options,
  stage,
}: {
  readonly product: string;
  readonly kind: InstallKind;
  readonly options: InstallOptions;
  readonly stage: InstallStage | null;
}) {
  const stages = installStages(kind, options);
  const current = stage ? stages.indexOf(stage) : -1;
  // Silent NSIS reports no finer progress, so the bar sits halfway through the active stage.
  const progress = current < 0 ? 0.04 : (current + 0.5) / stages.length;
  return (
    <Page title={progressTitle(kind, product)}>
      <Glass role="minor" floating className="installer-island">
        <ol className="installer-stages">
          {stages.map((item, index) => {
            const state = index < current ? "done" : index === current ? "active" : "pending";
            return (
              <li key={item} data-state={state}>
                <span className="installer-stage-dot" aria-hidden="true">
                  {state === "done" && <Check size={11} strokeWidth={3.2} />}
                </span>
                {stageLabel(item, kind)}
              </li>
            );
          })}
        </ol>
      </Glass>
      <div
        className="installer-progress"
        role="progressbar"
        aria-label={uiText("installer.progress.label")}
        aria-valuemin={0}
        aria-valuemax={stages.length}
        aria-valuenow={Math.max(0, current)}
      >
        <span className="installer-progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </Page>
  );
}

export function AppRunningScreen({ product, onBack }: { readonly product: string; readonly onBack: () => void }) {
  return (
    <Hero>
      <h1>{uiText("installer.appRunning.title", { product })}</h1>
      <p className="installer-body">{uiText("installer.appRunning.description", { product })}</p>
      <span className="installer-waiting" aria-hidden="true" />
      <Button className="installer-quiet" onClick={onBack}>
        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
        {uiText("installer.back")}
      </Button>
    </Hero>
  );
}

function finishedText(kind: InstallKind, product: string, version: string) {
  if (kind === "install") return uiText("installer.finished.installed", { product, version });
  if (kind === "update") return uiText("installer.finished.updated", { product, version });
  return uiText("installer.finished.reinstalled", { product, version });
}

function failureText(failure: InstallFailure, product: string) {
  switch (failure) {
    case "invalidLocation":
      return uiText("installer.failed.invalidLocation");
    case "prepare":
      return uiText("installer.failed.prepare");
    case "start":
      return uiText("installer.failed.start");
    case "failed":
      return uiText("installer.failed.failed", { product });
    case "notFound":
      return uiText("installer.failed.notFound", { product });
    case "shortcut":
      return uiText("installer.failed.shortcut", { product });
    case "appRunning":
      return uiText("installer.failed.appRunning", { product });
    case "newerInstalled":
      return uiText("installer.failed.newerInstalled", { product });
    case "unknown":
      return uiText("installer.failed.unknown");
  }
}

export function FinishedScreen({
  details,
  kind,
  launch,
  onLaunchChange,
  onFinish,
}: {
  readonly details: InstallerDetails;
  readonly kind: InstallKind;
  readonly launch: boolean;
  readonly onLaunchChange: (launch: boolean) => void;
  readonly onFinish: () => void;
}) {
  const product = details.productName;
  const launchLabel = uiText("installer.finished.launch", { product });
  return (
    <Hero>
      <h1>{uiText("installer.finished.title", { product })}</h1>
      <p className="installer-body">{finishedText(kind, product, details.version)}</p>
      <button
        type="button"
        role="checkbox"
        aria-checked={launch}
        className="installer-launch"
        onClick={() => onLaunchChange(!launch)}
      >
        <span className="installer-check" aria-hidden="true">
          {launch && <Check size={12} strokeWidth={3.2} />}
        </span>
        {launchLabel}
      </button>
      <Button variant="primary" className="installer-primary" onClick={onFinish} autoFocus>
        {uiText("installer.finished.finish")}
      </Button>
    </Hero>
  );
}

export function FailedScreen({
  product,
  failure,
  onRetry,
  onClose,
}: {
  readonly product: string;
  readonly failure: InstallFailure;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}) {
  return (
    <Page
      title={uiText("installer.failed.title")}
      actions={
        <>
          <Button onClick={onClose}>{uiText("common.close")}</Button>
          <Button variant="primary" onClick={onRetry} autoFocus>
            {uiText("installer.failed.retry")}
          </Button>
        </>
      }
    >
      <p className="installer-body" role="alert">
        {failureText(failure, product)}
      </p>
    </Page>
  );
}
