import { lazy, Suspense } from "react";
import { CredentialSecurityDialog } from "./ui/CredentialSecurityDialog";
import { DataTransferDialog } from "./ui/DataTransferDialog";
import { StartupProblem } from "./ui/StartupProblem";
import { useSettings } from "./data/settingsStore";
import { useLab } from "./lab/store";
import { dragRegion } from "./platform/window";
import { AccountList } from "./ui/AccountList";
import { Backdrop } from "./ui/Backdrop";
import { Header } from "./ui/Header";
import { ListScrollbar } from "./ui/ListScrollbar";
import { Rail } from "./ui/Rail";
import { AccountInfoDialog, CredentialsDialog, DeleteAccountDialog } from "./ui/AccountDialogs";

/** The Glass Lab exists only in dev builds; release builds don't contain it. */
const LabPanel = import.meta.env.DEV ? lazy(() => import("./lab/LabPanel").then((module) => ({ default: module.LabPanel }))) : null;
import { AccountMenu } from "./ui/AccountMenu";
import { ResetMenu } from "./ui/ResetMenu";
import { DeleteGroupDialog, GroupMenu } from "./ui/GroupMenu";
import { RankPicker } from "./ui/RankPicker";
import { UpdateDialog, WhatsNewDialog } from "./ui/AppUpdates";
import { SeasonResetDialog } from "./ui/SeasonResetDialog";
import { SettingsDialog } from "./ui/SettingsDialog";
import { ToastStack } from "./ui/ToastStack";
import { WindowControls } from "./ui/WindowControls";

/** `problem`: why the database couldn't be opened; the app then shows only that. */
export function App({ problem }: { readonly problem: string | null }) {
  const zoom = useSettings((settings) => settings.uiScale);
  const chrome = useLab((state) => state.chrome);
  const blocked = problem !== null;
  return (
    <div className="stage">
      <div className="app" style={{ zoom }} inert={blocked} aria-hidden={blocked || undefined}>
        <Backdrop />
        <div className="header-fade" aria-hidden="true" />
        {/* With a custom frame the top margin is the title bar: it drags the window. */}
        {chrome !== "native" && <div className="caption-strip" {...dragRegion(chrome)} />}
        <main className="frame">
          <div className="frame-main">
            {chrome === "caption" && (
              <>
                <div className="window-controls-fade" aria-hidden="true" />
                <WindowControls layout="row" />
              </>
            )}
            <Header />
            <AccountList />
            <ListScrollbar />
          </div>
          {chrome === "rail" && <Rail />}
        </main>
      </div>
      {/* Overlays sit outside the zoomed app: the UI scale only scales the rows' viewport (and the
          window width), never Settings or the rank picker. */}
      <div className="overlays">
        {blocked ? <><StartupProblem problem={problem} /><ToastStack /></> : <>
        <RankPicker />
        <AccountMenu />
        <ResetMenu />
        <GroupMenu />
        <SettingsDialog />
        <CredentialSecurityDialog />
        <AccountInfoDialog />
        <CredentialsDialog />
        <DeleteAccountDialog />
        <DeleteGroupDialog />
        <SeasonResetDialog />
        <DataTransferDialog />
        <UpdateDialog />
        <WhatsNewDialog />
        <ToastStack />
        </>}
      </div>
      {LabPanel && !blocked && (
        <Suspense fallback={null}>
          <LabPanel />
        </Suspense>
      )}
    </div>
  );
}
