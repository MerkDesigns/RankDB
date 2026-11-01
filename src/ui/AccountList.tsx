import { uiText } from "../text/index";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, EllipsisVertical } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type { Account, Group } from "../data/accounts";
import { renameGroup, setGroupCollapsed, useRoleSort, useRoster } from "../data/rosterStore";
import { Glass, InList } from "../glass/Glass";
import { ListPlane } from "../glass/ListPlane";
import { registerScroller } from "../lab/perf";
import { AccountRow } from "./AccountRow";
import { useListDrag } from "./listDrag";
import { useSortMotion } from "./sortMotion";
import { stopEditing, useIsEditingGroup, startEditing } from "./editing";
import { openGroupMenu } from "./GroupMenu";
import { InlineEdit } from "./primitives/InlineEdit";

export function AccountList() {
  const roster = useRoster();
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const setScroller = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    registerScroller(element);
  }, []);
  useListDrag(contentRef, scrollerRef);
  useScrollingFlag(scrollerRef);
  useSortMotion(contentRef, useRoleSort()?.slot ?? null);

  // The shared glass plane re-measures when the list's shape changes.
  const layoutKey = [
    roster.sorted,
    roster.entries
      .map((entry) =>
        entry.kind === "account" ? "a" : `${entry.group.id}${entry.group.collapsed ? "-" : "="}${entry.accounts.length}`,
      )
      .join(","),
    roster.sms.length,
    roster.banned.length,
  ].join(":");

  // Alternating row plates restart in every block (a run of loose rows, a group, the banned
  // section), so each block starts the same way.
  let run = 0;

  return (
    <div ref={setScroller} className="list-scroller">
      <div ref={contentRef} className="list-content">
        <InList.Provider value>
          <ListPlane contentRef={contentRef} scrollerRef={scrollerRef} layoutKey={layoutKey} />
          {roster.entries.map((entry) => {
            if (entry.kind === "account") {
              return <AccountRow key={entry.account.id} account={entry.account} stripe={run++ % 2 === 0} />;
            }
            run = 0;
            return <GroupBlock key={entry.group.id} group={entry.group} accounts={entry.accounts} />;
          })}

          <Section status="sms" label={uiText("accountList.sections.sms")} accounts={roster.sms} />
          <Section status="banned" label={uiText("accountList.sections.banned")} accounts={roster.banned} />
        </InList.Provider>
      </div>
    </div>
  );
}

/** How long after the last scroll event the list counts as still scrolling. */
const SCROLL_SETTLE_MS = 200;

/**
 * Marks the list `data-scrolling` while it scrolls. Sparkles and shines (rank effects) stop
 * meanwhile (rankEffects.ts): their animated layers made every row scrolling into view
 * re-layerize the list.
 */
function useScrollingFlag(scrollerRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let timer = 0;
    const onScroll = () => {
      if (!timer) scroller.dataset.scrolling = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        delete scroller.dataset.scrolling;
      }, SCROLL_SETTLE_MS);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [scrollerRef]);
}

/** The SMS or banned section: its divider, then its rows (siblings of the list's top level). */
function Section({
  status,
  label,
  accounts,
}: {
  readonly status: "sms" | "banned";
  readonly label: string;
  readonly accounts: readonly Account[];
}) {
  if (accounts.length === 0) return null;
  return (
    <>
      <div className="section-divider" data-status={status}>
        <span className="section-line" />
        <span className="section-pill">{label}</span>
        <span className="section-line" />
      </div>
      {accounts.map((account, index) => (
        <AccountRow key={account.id} account={account} stripe={index % 2 === 0} />
      ))}
    </>
  );
}

/** A group: its head (collapse, name, count, menu) and, unless collapsed, its accounts. */
function GroupBlock({ group, accounts }: { readonly group: Group; readonly accounts: readonly Account[] }) {
  const editing = useIsEditingGroup(group.id);
  const menuAt = (x: number, y: number) => openGroupMenu(group.id, x, y);
  return (
    <Glass role="minor" className="group" data-group-id={group.id}>
      <div
        className="group-head"
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest("input")) return;
          event.preventDefault();
          menuAt(event.clientX, event.clientY);
        }}
      >
        <button
          type="button"
          className="group-toggle"
          data-collapsed={group.collapsed || undefined}
          aria-expanded={!group.collapsed}
          aria-label={group.collapsed ? uiText("accountList.expandGroup") : uiText("accountList.collapseGroup")}
          onClick={() => setGroupCollapsed(group.id, !group.collapsed)}
        >
          <ChevronDown size={18} strokeWidth={2.35} />
        </button>
        {editing ? (
          <InlineEdit
            className="group-name-edit"
            label={uiText("accountList.groupName")}
            initial={group.name}
            maxLength={40}
            onCommit={(value) => renameGroup(group.id, value)}
            onDone={stopEditing}
          />
        ) : (
          <span className="group-name" onDoubleClick={() => startEditing({ kind: "group", groupId: group.id })}>
            {group.name}
          </span>
        )}
        <span className="group-count">
          {accounts.length} {accounts.length === 1 ? uiText("accountList.count.singular") : uiText("accountList.count.plural")}
        </span>
        <button
          type="button"
          className="group-menu-button"
          aria-label={uiText("accountList.groupActions")}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            menuAt(rect.left, rect.bottom + 4);
          }}
        >
          <EllipsisVertical size={18} />
        </button>
      </div>
      <GroupBody collapsed={group.collapsed}>
        {/* Rows have no outlines, so two rounded brackets enclose a group's accounts. */}
        <span className="group-rule group-rule-top" aria-hidden="true" />
        {accounts.length > 0 ? (
          <div className="group-rows">
            {accounts.map((account, index) => (
              <AccountRow key={account.id} account={account} stripe={index % 2 === 0} />
            ))}
          </div>
        ) : (
          <p className="group-empty">{uiText("accountList.emptyGroup")}</p>
        )}
        <span className="group-rule group-rule-bottom" aria-hidden="true" />
      </GroupBody>
    </Glass>
  );
}

/** How long a group takes to open or close (styles: .group-body). */
const GROUP_BODY_MS = 240;

/**
 * A group's accounts, opening and closing with an eased height (grid rows 0fr ↔ 1fr) and fade.
 * Closed, the rows aren't rendered; they stay mounted only while the close animation plays, and
 * an opening group mounts them closed and opens on the next frame.
 */
function GroupBody({ collapsed, children }: { readonly collapsed: boolean; readonly children: ReactNode }) {
  const [mounted, setMounted] = useState(!collapsed);
  const [open, setOpen] = useState(!collapsed);
  const [animating, setAnimating] = useState(false);
  const first = useRef(true);

  // Each change of `collapsed` starts its own animation (a quick close-open-close included).
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (collapsed) {
      setOpen(false);
      setAnimating(true);
      const timer = window.setTimeout(() => {
        setMounted(false);
        setAnimating(false);
      }, GROUP_BODY_MS);
      return () => window.clearTimeout(timer);
    }
    setMounted(true);
    setAnimating(true);
    // Rendered closed first, so the opening has something to animate from.
    const frame = requestAnimationFrame(() => setOpen(true));
    const timer = window.setTimeout(() => setAnimating(false), GROUP_BODY_MS + 20);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [collapsed]);

  if (!mounted) return null;
  return (
    <div className="group-body" data-open={open || undefined} data-animating={animating || undefined}>
      <div className="group-body-inner">{children}</div>
    </div>
  );
}
