import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startGlassEngine } from "../glass/engine";
import { installDragHandling } from "../platform/window";
import { createTauriInstallerClient } from "./installerClient";
import { InstallerApp } from "./InstallerApp";
import { createPreviewInstallerClient } from "./previewInstallerClient";
import "../styles/app.css";
import "../styles/glass.css";
import "../styles/dialogs.css";
import "../styles/primitives.css";
import "../styles/controls.css";
import "./installer.css";

// `?preview` (development only) shows any screen without touching the system; see
// previewInstallerClient.ts for its flags.
const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
const client = preview ? createPreviewInstallerClient() : createTauriInstallerClient();

// The app's glass runs from its defaults here: no database, no saved settings, nothing persisted.
startGlassEngine();
installDragHandling();

// Rendered synchronously while the window is still hidden (hidden webviews fire no animation
// frames), then shown, so it never flashes empty.
const root = createRoot(document.getElementById("root")!);
flushSync(() =>
  root.render(
    <StrictMode>
      <InstallerApp client={client} />
    </StrictMode>,
  ),
);
void client.show();
