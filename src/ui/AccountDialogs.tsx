import { uiText, rankName } from "../text/index";
import { invoke } from "@tauri-apps/api/core";
import { command } from "../data/backend";
import { ensureCredentialsUnlocked } from "../data/credentialSecurity";
import { ExternalLink, Eye, EyeOff, KeyRound, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { displayAccountName, type AccountStatus, type Rank } from "../data/accounts";
import { ICONS, RANK_IMAGES, ROLE_ICONS } from "../data/assets";
import { COUNTRIES, flagOf } from "../data/countries";
import { deleteAccount, findAccount, isSavedData, setCredentials, setStatus } from "../data/rosterStore";
import { STATUSES } from "./AccountMenu";
import { useSettings } from "../data/settingsStore";
import { dialogs, useOpenDialog, type Dialog as OpenDialog } from "./appActions";
import { Button } from "./primitives/Button";
import { Dialog } from "./primitives/Dialog";
import { Field, Select, TextArea, TextInput } from "./primitives/Field";
import { LiquidTabs, type LiquidTab } from "./primitives/LiquidTabs";
import { removeWithMotion } from "./sortMotion";
import { showError, showToast } from "./toasts";

type AccountDialogKind = "credentials" | "delete-account" | "account-info";

/**
 * Whether the given account dialog is open, and for which account. The account id is kept while
 * the dialog animates out.
 */
function useAccountDialog(kind: AccountDialogKind) {
  const dialog: OpenDialog = useOpenDialog();
  const open = dialog?.kind === kind;
  const accountId = useRef<number | null>(null);
  if (open && "accountId" in dialog) accountId.current = dialog.accountId;
  return { open, accountId: accountId.current };
}

/** The name as the list shows it (privacy mode shortens it here too). */
function useShownName(accountId: number | null): string {
  const privacyMode = useSettings((settings) => settings.privacyMode);
  const privacyChars = useSettings((settings) => settings.privacyChars);
  const account = accountId === null ? undefined : findAccount(accountId);
  return account ? displayAccountName(account.name, privacyMode, privacyChars) : "";
}

/** "(icon) Title | Battletag", as the old app's account windows. */
function DialogTitle({ Icon, title, name }: { readonly Icon: LucideIcon; readonly title: string; readonly name: string }) {
  return (
    <span className="info-title">
      <span className="info-title-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={2.1} />
      </span>
      <span>{title}</span>
      <span className="info-title-divider" aria-hidden="true">{uiText("accountDialogs.titleSeparator")}</span>
      <span className="info-title-name">{name}</span>
    </span>
  );
}

/* ---------- Edit credentials ---------- */

export function CredentialsDialog() {
  const { open, accountId } = useAccountDialog("credentials");
  const name = useShownName(accountId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "unavailable">("loading");

  // The saved values are fetched only now, for this dialog, and dropped when it closes.
  useEffect(() => {
    if (!open || accountId === null) return;
    setShowPassword(false);
    if (!isSavedData()) {
      setState("unavailable");
      return;
    }
    setState("loading");
    let cancelled = false;
    ensureCredentialsUnlocked().then((unlocked) => {
      if (cancelled) return null;
      if (!unlocked) { dialogs.close(); return null; }
      return command<{ email: string; password: string }>("get_credentials", { accountId });
    })
      .then((saved) => {
        if (cancelled || !saved) return;
        setEmail(saved.email);
        setPassword(saved.password);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        showError(uiText("accountDialogs.credentials.loadFailed"), error);
        dialogs.close();
      });
    return () => {
      cancelled = true;
      setEmail("");
      setPassword("");
    };
  }, [open, accountId]);

  const save = async () => {
    if (accountId === null || state !== "ready") return;
    setState("saving");
    if (await setCredentials(accountId, email, password)) {
      showToast({ tone: "success", title: uiText("accountDialogs.credentials.saved") });
      dialogs.close();
    } else {
      setState("ready");
    }
  };

  return (
    <Dialog open={open} onClose={dialogs.close} title={<DialogTitle Icon={KeyRound} title={uiText("accountDialogs.credentials.title")} name={name} />} className="account-dialog">
      {state === "unavailable" ? (
        <p className="dialog-note">{uiText("accountDialogs.credentials.dummyNotice")}</p>
      ) : (
        <form
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field label={uiText("common.email")}>
            <TextInput
              data-autofocus=""
              type="email"
              autoComplete="off"
              value={email}
              disabled={state !== "ready"}
              maxLength={512}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label={uiText("common.password")}>
            <TextInput
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              value={password}
              disabled={state !== "ready"}
              maxLength={512}
              onChange={(event) => setPassword(event.target.value)}
              trailing={
                <button
                  type="button"
                  className="input-icon-button"
                  aria-label={showPassword ? uiText("accountDialogs.credentials.hidePassword") : uiText("accountDialogs.credentials.showPassword")}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={2.1} /> : <Eye size={16} strokeWidth={2.1} />}
                </button>
              }
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={dialogs.close}>{uiText("common.cancel")}</Button>
            <Button type="submit" variant="primary" disabled={state !== "ready"}>{uiText("common.save")}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* ---------- Delete account ---------- */

export function DeleteAccountDialog() {
  const { open, accountId } = useAccountDialog("delete-account");
  const name = useShownName(accountId);
  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("accountDialogs.delete.title")} className="account-dialog">
      <p className="dialog-text">{uiText("accountDialogs.delete.promptPrefix")}<strong>{name}</strong>{uiText("accountDialogs.delete.promptSuffix")}</p>
      <div className="dialog-actions">
        <Button data-autofocus="" onClick={dialogs.close}>{uiText("common.cancel")}</Button>
        <Button
          variant="danger"
          onClick={() => {
            if (accountId !== null) removeWithMotion({ accountId }, () => deleteAccount(accountId));
            showToast({ tone: "success", title: uiText("accountDialogs.delete.success"), message: name });
            dialogs.close();
          }}
        >{uiText("common.delete")}</Button>
      </div>
    </Dialog>
  );
}

/* ---------- Account info ---------- */

interface AccountDetails {
  readonly country: string;
  readonly notes: string;
}

const INFO_TABS: readonly LiquidTab<"details" | "history">[] = [
  { value: "details", label: uiText("accountDialogs.tabs.details") },
  { value: "history", label: uiText("accountDialogs.tabs.history") },
];

const STATUS_TABS: readonly LiquidTab<AccountStatus>[] = STATUSES.map(({ value, label }) => ({ value, label }));

export function AccountInfoDialog() {
  const { open, accountId } = useAccountDialog("account-info");
  const name = useShownName(accountId);
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatusDraft] = useState<AccountStatus>("clean");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"details" | "history">("details");
  const [history, setHistory] = useState<readonly RankHistoryEntry[] | null>(null);
  const account = accountId === null ? undefined : findAccount(accountId);

  useEffect(() => {
    if (!open || accountId === null) return;
    setDetails(null);
    setHistory(null);
    setTab("details");
    setStatusDraft(findAccount(accountId)?.status ?? "clean");
    if (!isSavedData()) return;
    let cancelled = false;
    Promise.all([
      command<AccountDetails>("get_account_details", { accountId }),
      command<RankHistoryEntry[]>("get_rank_history", { accountId }),
    ])
      .then(([loaded, ranks]) => {
        if (cancelled) return;
        setDetails(loaded);
        setCountry(loaded.country);
        setNotes(loaded.notes);
        setHistory(ranks);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        showError(uiText("accountDialogs.info.loadFailed"), error);
        dialogs.close();
      });
    return () => {
      cancelled = true;
    };
  }, [open, accountId]);

  const detailsChanged = details !== null && (country !== details.country || notes !== details.notes);
  const statusChanged = account !== undefined && status !== account.status;

  const save = async () => {
    if (accountId === null || (!detailsChanged && !statusChanged)) {
      dialogs.close();
      return;
    }
    setSaving(true);
    try {
      if (detailsChanged) await command("set_account_details", { accountId, country, notes });
      if (statusChanged) setStatus(accountId, status);
      showToast({ tone: "success", title: uiText("accountDialogs.info.saved") });
      dialogs.close();
    } catch (error) {
      showError(uiText("accountDialogs.info.saveFailed"), error);
    } finally {
      setSaving(false);
    }
  };

  const flag = flagOf(country);
  const formId = useId();
  const title = <DialogTitle Icon={UserRound} title={uiText("accountDialogs.info.title")} name={name} />;
  return (
    <Dialog open={open} onClose={dialogs.close} title={title} className="account-dialog account-info">
      {!isSavedData() ? (
        <p className="dialog-note">{uiText("accountDialogs.info.dummyNotice")}</p>
      ) : (
        <>
          <LiquidTabs label={uiText("accountDialogs.tabs.accessibleLabel")} className="dialog-tabs" tabs={INFO_TABS} value={tab} onChange={setTab} />
          {/* Both tabs share one cell: Details sets the height, Rank history scrolls within it. */}
          <div className="info-panels">
            <form
              id={formId}
              className="info-details"
              data-inactive={tab !== "details" || undefined}
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="info-section">
                <span className="info-label">{uiText("accountDialogs.country.label")}</span>
                <div className="country-row">
                  <Select
                    data-autofocus=""
                    value={country}
                    disabled={!details}
                    aria-label={uiText("accountDialogs.country.label")}
                    onChange={(event) => setCountry(event.target.value)}
                  >
                    <option value="">{uiText("accountDialogs.country.empty")}</option>
                    {COUNTRIES.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.label}{uiText("accountDialogs.country.dialCodePrefix")}{entry.dialCode}{uiText("accountDialogs.country.dialCodeSuffix")}</option>
                    ))}
                  </Select>
                  <span className="country-flag">{flag && <img src={flag} alt="" draggable={false} />}</span>
                </div>
                <Button
                  className="battlenet-button"
                  onClick={() => invoke("open_battlenet").catch((error: unknown) => showError(uiText("accountDialogs.battlenet.openFailed"), error))}
                >
                  <img src={ICONS.battlenet} alt="" draggable={false} />{uiText("accountDialogs.battlenet.action")}<ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
                </Button>
              </div>
              <label className="info-section info-notes">
                <span className="info-label">{uiText("accountDialogs.notes.label")}</span>
                <TextArea
                  className="notes"
                  value={notes}
                  disabled={!details}
                  maxLength={4000}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="info-section">
                <span className="info-label">{uiText("accountDialogs.status.label")}</span>
                <div className="status-tabs" data-status={status}>
                  <LiquidTabs label={uiText("accountDialogs.status.label")} tabs={STATUS_TABS} value={status} onChange={setStatusDraft} />
                </div>
              </div>
            </form>
            <RankHistory entries={history} inactive={tab !== "history"} />
          </div>
          <div className="info-actions">
            <Button onClick={dialogs.close}>{uiText("common.cancel")}</Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              disabled={(!detailsChanged && !statusChanged) || saving}
            >{uiText("common.save")}</Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

interface RankHistoryEntry {
  readonly slot: "tank" | "damage" | "support" | "sixv6";
  readonly rank: Rank;
  readonly changedAt: string;
}

const SLOTS = [
  { slot: "tank", icon: ROLE_ICONS[0], label: uiText("accountDialogs.history.roles.tank") },
  { slot: "damage", icon: ROLE_ICONS[1], label: uiText("accountDialogs.history.roles.damage") },
  { slot: "support", icon: ROLE_ICONS[2], label: uiText("accountDialogs.history.roles.support") },
  { slot: "sixv6", icon: ICONS.flex, label: uiText("accountDialogs.history.roles.sixVersusSix") },
] as const;

const RESET_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Past season resets, newest first: the date, then the four ranks each reset cleared. */
function RankHistory({
  entries,
  inactive,
}: {
  readonly entries: readonly RankHistoryEntry[] | null;
  readonly inactive: boolean;
}) {
  const resets = new Map<string, Map<string, Rank>>();
  for (const entry of entries ?? []) {
    const reset = resets.get(entry.changedAt) ?? new Map<string, Rank>();
    reset.set(entry.slot, entry.rank);
    resets.set(entry.changedAt, reset);
  }
  return (
    <div className="rank-history" data-inactive={inactive || undefined}>
      <div className="history-row history-head">
        <span />
        {SLOTS.map(({ slot, icon, label }) => (
          <img key={slot} src={icon} alt={label} className="history-role" draggable={false} />
        ))}
      </div>
      <div className="history-body">
        {entries === null ? null : resets.size === 0 ? (
          <p className="history-empty">{uiText("accountDialogs.history.empty")}</p>
        ) : (
          [...resets].map(([resetAt, ranks]) => (
            <div key={resetAt} className="history-row">
              <span className="history-date">{RESET_DATE.format(new Date(resetAt))}</span>
              {SLOTS.map(({ slot, label }) => (
                <StaticBadge key={slot} rank={ranks.get(slot)} label={label} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** A row's rank badge, for display only. */
function StaticBadge({ rank, label }: { readonly rank: Rank | undefined; readonly label: string }) {
  const tier = rank?.tier ?? "Unranked";
  const state = tier === "Unranked" ? "unranked" : rank?.predicted ? "predicted" : "ranked";
  return (
    <span className="badge" data-state={state} aria-label={uiText("accountDialogs.history.rankAccessibleLabel", { label: label, rank: tier === "Unranked" ? rankName(tier) : uiText("accountDialogs.history.rank", { tier: rankName(tier), division: rank!.division }) })}>
      <img src={RANK_IMAGES[tier]} alt="" draggable={false} />
      {tier !== "Unranked" && <span className="badge-number">{rank!.division}</span>}
    </span>
  );
}
