import { uiText } from "../text/index";
import { memo, type CSSProperties } from "react";
import { Copy, KeyRound, User } from "lucide-react";
import { displayAccountName, formatCompactValue, type Account } from "../data/accounts";
import { ICONS } from "../data/assets";
import { copyBattletag, copySecret } from "../data/copy";
import { profileImageUrl, useProfile } from "../data/profiles";
import { renameAccount, setCurrency, useViewedReset } from "../data/rosterStore";
import { useSettings } from "../data/settingsStore";
import { Glass } from "../glass/Glass";
import { openAccountMenu } from "./AccountMenu";
import { clearNew, startEditing, stopEditing, useIsEditing, useIsNew } from "./editing";
import { InlineEdit, parseAmount } from "./primitives/InlineEdit";
import { RankBadge } from "./RankBadge";
import { openRankPicker, usePickerEdit } from "./RankPicker";

/** `stripe`: the plated rows when the lab's row background is "every other row". */
export const AccountRow = memo(function AccountRow({
  account,
  stripe,
}: {
  readonly account: Account;
  readonly stripe: boolean;
}) {
  // Past ranks on screen (toolbar): the badges only show them.
  const viewingPast = useViewedReset() !== null;
  // The badge the rank picker is editing shows its draft.
  const edit = usePickerEdit(account.id);
  const { avatar, banner } = useProfileImages(account.id);
  return (
    <div
      className="row"
      data-account-id={account.id}
      data-stripe={stripe || undefined}
      onContextMenu={(event) => {
        // Text fields keep their own (cut/copy/paste) menu.
        if ((event.target as HTMLElement).closest("input")) return;
        event.preventDefault();
        openAccountMenu(account.id, event.clientX, event.clientY);
      }}
    >
      <Glass role="minor" className="lead">
        {/* One outlined pill (like the Battletag button), split by the divider. */}
        <span className="lead-pill">
          <button
            type="button"
            className="lead-button"
            aria-label={account.hasEmail ? uiText("accountRows.copyEmail") : uiText("accountRows.noEmailSaved")}
            data-empty={!account.hasEmail || undefined}
            onClick={() => void copySecret(account, "email")}
          >
            <User size={20} strokeWidth={2.25} />
          </button>
          <span className="lead-divider" />
          <button
            type="button"
            className="lead-button"
            aria-label={account.hasPassword ? uiText("accountRows.copyPassword") : uiText("accountRows.noPasswordSaved")}
            data-empty={!account.hasPassword || undefined}
            onClick={() => void copySecret(account, "password")}
          >
            <KeyRound size={20} strokeWidth={2.25} />
          </button>
        </span>
      </Glass>

      <Glass role="minor" className="primary" tone="primary">
        {banner && <span className="row-banner" aria-hidden="true" style={{ "--banner": `url("${profileImageUrl(banner)}")` } as CSSProperties} />}
        <div className="name-cell">
          <button
            type="button"
            className="bnet-button"
            data-avatar={avatar ? "" : undefined}
            aria-label={uiText("accountRows.copyBattletag")}
            onClick={() => void copyBattletag(account)}
          >
            <img src={avatar ? profileImageUrl(avatar) : ICONS.battlenet} alt="" draggable={false} />
            {/* On hover: darkened, with a copy icon, so it reads as "copy BattleTag". */}
            <span className="bnet-copy" aria-hidden="true">
              <Copy size={18} strokeWidth={2.4} />
            </span>
          </button>
          <AccountName account={account} />
        </div>
        <div className="rank-lane">
          {account.ranks.map((rank, index) => (
            <RankBadge
              key={index}
              rank={edit?.slot === index ? edit.rank : rank}
              editing={edit?.slot === index}
              onPick={viewingPast ? undefined : (badge) => openRankPicker(account.id, index as 0 | 1 | 2, badge)}
            />
          ))}
        </div>
      </Glass>

      <Glass role="minor" className="sixv6">
        <RankBadge
          rank={edit?.slot === "sixV6" ? edit.rank : account.sixV6}
          editing={edit?.slot === "sixV6"}
          onPick={viewingPast ? undefined : (badge) => openRankPicker(account.id, "sixV6", badge)}
        />
      </Glass>

      <Glass role="minor" className="credits">
        <div className="value-lane value-lane-a">
          {account.valuesA.map((value, index) => (
            <AccountValue key={index} account={account} lane="valuesA" index={index} value={value} />
          ))}
        </div>
        <div className="value-lane value-lane-b">
          {account.valuesB.map((value, index) => (
            <AccountValue key={index} account={account} lane="valuesB" index={index} value={value} />
          ))}
        </div>
      </Glass>
    </div>
  );
});

/** The Battletag; double-click (or the menu's Edit Battletag) edits it in place. */
function AccountName({ account }: { readonly account: Account }) {
  const privacyMode = useSettings((settings) => settings.privacyMode);
  const privacyChars = useSettings((settings) => settings.privacyChars);
  const editing = useIsEditing(account.id, "name");
  const isNew = useIsNew(account.id);
  if (editing) {
    return (
      <InlineEdit
        className="account-name-edit"
        label={uiText("accountRows.battletag")}
        initial={account.name}
        maxLength={64}
        onCommit={(value) => {
          if (!value.trim()) return;
          renameAccount(account.id, value);
          clearNew(account.id);
        }}
        onDone={stopEditing}
      />
    );
  }
  return (
    <span className="account-name-line" onDoubleClick={() => startEditing({ accountId: account.id, kind: "name" })}>
      <span className="account-name">{displayAccountName(account.name, privacyMode, privacyChars)}</span>
      {isNew && <span className="new-pill">{uiText("common.new")}</span>}
    </span>
  );
}

/** A currency amount; a click edits it in place ("1.2k" and "1,234" are understood). */
function AccountValue({
  account,
  lane,
  index,
  value,
}: {
  readonly account: Account;
  readonly lane: "valuesA" | "valuesB";
  readonly index: number;
  readonly value: number;
}) {
  const editing = useIsEditing(account.id, lane, index);
  if (editing) {
    return (
      <InlineEdit
        className="value-edit"
        label={uiText("accountRows.amount")}
        initial={String(value)}
        inputMode="numeric"
        maxLength={12}
        onCommit={(text) => {
          const amount = parseAmount(text);
          if (amount !== null) setCurrency(account.id, lane, index, amount);
        }}
        onDone={stopEditing}
      />
    );
  }
  return (
    <button
      type="button"
      className="value"
      onClick={() => startEditing({ accountId: account.id, kind: lane, index })}
    >
      {formatCompactValue(value)}
    </button>
  );
}

/**
 * The account's profile picture and banner (experimental, data/profiles.ts), if the feature is on,
 * that part is chosen in Settings, privacy mode is off (both identify an account on stream), and
 * owapi.eu had one. Otherwise the Battle.net icon and no banner.
 */
function useProfileImages(accountId: number): { avatar: string | null; banner: string | null } {
  const profile = useProfile(accountId);
  const enabled = useSettings((settings) => settings.profileImages && !settings.privacyMode);
  const showAvatar = useSettings((settings) => settings.profileAvatar);
  const showBanner = useSettings((settings) => settings.profileBanner);
  if (!enabled || !profile) return { avatar: null, banner: null };
  return { avatar: showAvatar ? profile.avatar : null, banner: showBanner ? profile.banner : null };
}
