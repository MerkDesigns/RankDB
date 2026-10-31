# Notification references (2026-10-30)

Implementation update: the user subsequently requested Sonner. `sonner@2.0.8` is now installed and
active with `expand` and three visible cards. The former custom stack and eight-entry waiting queue
have been removed. See `HANDOFF.md` for current implementation and verification; the recommendation
section below records the research preceding that change.

The user requested research into how popular applications handle toast stacking and spam after the
single-card regression. These are documented patterns, not observations of every product's live UI.

## Primary references

- [Sonner author's implementation notes](https://emilkowal.ski/ui/building-a-toast-component):
  retargetable transitions avoid jumps when arrivals interrupt motion; absolute positioning and
  measured heights support stacking. A compact stack expands on hover, or `expand` keeps cards fully
  visible. Hover/hidden-document timers pause, and hover gaps are bridged. The author reports use by
  Cursor, X and OpenAI; that adoption statement was not independently verified in this research.
- [Adobe React Spectrum toast documentation](https://react-spectrum.adobe.com/v3/Toast.html):
  ordered queue, newest at the bottom; hover/focus pause; five-second minimum auto-dismiss; actionable
  notices do not auto-dismiss. A keyboard-navigable notification region restores focus on closing.
- [VS Code notification guidance](https://code.visualstudio.com/api/ux-guidelines/notifications) and
  [notification center](https://code.visualstudio.com/docs/editing/getting-started/userinterface):
  send notifications sparingly; a notification center preserves access to messages and supports
  Do Not Disturb/filtering. The product's full history model is more than RankDB currently needs.
- [Google Material Android snackbar implementation docs](https://github.com/material-components/material-components-android/blob/master/docs/components/Snackbar.md):
  one snackbar at a time, for temporary brief feedback. This is a different model from the visible
  multi-card stack the RankDB user expects.
- [GitHub Primer accessibility guidance](https://primer.style/accessibility/patterns/accessible-notifications-and-messages/):
  recommends alternative feedback patterns rather than toasts because transient messages can be
  difficult to perceive/access. Relevant when deciding whether an error should be inline/persistent.

## Recommendation, not an implemented change

Use Sonner's expanded layout as the behavioral reference while keeping RankDB's glass/presence:

- Clearly separate user actions into individual cards, newest at the bottom, three visible.
- Use retargetable movement for arrivals/removals and preserve exit space until an exit finishes.
- For routine spam, prefer recent feedback over replaying an eight-item queue after it is stale.
- Pause ordinary notices while interacting with the stack, including gaps and keyboard navigation.
- Keep real clipboard deadlines accurate; treat Undo/error accessibility separately from routine
  success auto-dismiss. Spectrum's non-expiring actions cannot simply be copied onto a real deadline.
- Keep important failures available until acknowledged or available elsewhere.

The source implementation at the time of this research still has the previously documented
three-card/eight-waiting queue and 400ms identical-event merge window. This research did not implement
the proposed refinements or add a notification-center feature.
