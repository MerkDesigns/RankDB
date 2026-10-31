# Editing RankDB's text

Open **[`src/text/strings.json`](../src/text/strings.json)**. This is the single source for RankDB's
authored interface wording: settings, option descriptions, buttons, tooltips, menus, dialogs,
notifications, country and rank labels, What's New, Discord presence, the Glass Lab and app-written
backend errors. You do not need to find the React component or Rust command that displays it.

The file is grouped by area. Start with `settings` for Settings, `toolbar` for toolbar tooltips,
`accountMenu` for account actions, `notifications` / `clipboard` for notifications, and `lab` /
`labOptions` for the UI Lab. `common` contains shared words such as Save and Cancel. A shared entry
changes everywhere it is used. `errors` contains errors written by RankDB; detailed messages from
Windows, SQLite and other external libraries still come from those libraries.

## Change the value on the right

For example, inside `settings`:

```json
"credentialButtons": {
  "label": "Credential buttons",
  "description": "Copy the account's email and password"
}
```

You can replace those two values with your own label and explanation. Keep the keys on the left,
the surrounding quotes and commas. Save the file as UTF-8. Use `\"` for a quotation mark inside a
value, and `\n` for a line break. Values are plain text; HTML tags will be shown as text.

IDs describe **where the text is used**, not its current wording. For example,
`settings.credentialButtons.description` remains the same if you rewrite that description entirely.
`label`, `description`, `title`, `help` and `actions` indicate the role of each message. Do not rename
an ID just because its wording changes. Labels and buttons use sentence case ("Change password"),
with capitals for names/acronyms such as RankDB, Discord, BattleTag and SMS. Buttons have no trailing
ellipsis, including their busy states.

Some values contain placeholders:

```json
"summary": "{dodged} dodged in last 20 games"
```

Keep `{dodged}` unchanged, including its spelling and braces. You can move it within the sentence.
The app fills it with the current number. Keep every existing placeholder; the validation command
checks for missing or accidentally renamed placeholders. A few entries are fragments around bold
text or account names; preserve any leading/trailing spaces that separate those fragments.

Save while `npm run app:dev:mcp` or `npm run app:dev` is running to see your changes. Because Rust
errors use the same file, saving it also triggers the desktop app's rebuild/restart. For an installed
build, rebuild and reinstall with `npm run bundle:dev` to include the new wording.

To check your edits:

```powershell
npm run check:strings
```

This checks the JSON, referenced entries and placeholders. `npm run check` includes this check plus
the frontend and Rust builds. It cannot judge whether a much longer label fits visually, so inspect
the affected screen after larger wording changes.

## What stays separate

Account/group names, credentials, notes and other user data are not interface strings. Existing
account/group names stay as saved. Editing `toolbar.groupDefaultName` changes the initial name of future
groups. `rankNames.Gold` changes the displayed rank label while the stored rank remains `Gold`;
country names work the same way with fixed country codes. Keyboard bindings, units computed by
date/number formatters, system-owned menus and installer/window product metadata are separate.

There is one English catalog today. This prepares the text for future translations; it does not
add a language selector or automatically translate wording.

## Adding new interface text (for developers)

Add a stable semantic key under the appropriate feature, then use e.g.
`uiText("settings.credentialButtons.description")` from
`src/text/index.ts`. Supply named placeholders as an explicit object. Keys are checked by TypeScript;
`check:strings` additionally checks references, placeholders and unreferenced entries. Display rank
labels through `rankName(tier)`; never replace rank IDs, command names or persisted enum values with
translated labels. Rust uses `crate::text::text` / `crate::text::format` from the same embedded JSON.
Keep new authored copy here instead of returning to strings scattered across components.
Name keys for their feature and role; do not generate IDs by truncating English sentences or
adding numeric suffixes to distinguish unrelated messages. Use a new contextual key if two texts
have different purposes even when their current wording happens to match.
