# Recall

Recall is recent + fuzzy. One key lists every space, tab, pane and agent you've been in, most recently focused first, and opens on the one you were in just before this one, so Enter takes you back. Typing narrows the list by fuzzy match, close matches first, with the recent order kept within them. Each row shows where it lives, its folder, its branch and whether an agent there needs you. The All list has every space, tab, pane and agent in one place, and a Clues list finds a pane by what it runs, its ssh host, port, process or the text it printed. This is a dialog you add to your current layout, not a layout of its own.

![Recall](preview.png)

This file is the brief: enough to build Recall from an empty folder. The files next to it are one build of it. If they don't work on your Herdr, or you want it different, build it again from here.

## What you see

- A dialog in the middle of the window, 74% of its width and 70% of its height, on the theme's popover background. Text is 13px in the theme's foreground. Every size below is as designed for that text; the dialog draws them all to scale when its text size differs (see Text size and font).
- **Header**, 48px high with a bottom border: the category's title on the left (150px, 14px semibold: "Find Anywhere", "Recent Spaces", "Recent Tabs", "Recent Panes", "Agents", "Find by Clue"), then a search field filling the rest (30px high, radius 8, a search icon, the row count on the right as `7` or `3/7` while searching; its border is the accent color while you type). On Agents, a segmented control follows: Recent, Priority, Grouped. "Esc" sits at the far right.
- **Rail** on the left, 60px wide with a right border: one 48×46 entry per category (All, Spaces, Tabs, Panes, Agents, Clues), a 16px icon over a 9.5px label. All's icon is four small squares; Clues' is the search glass. The current one has the selected background and an accent icon.
- **Table** filling the rest:
  - A 26px column head in 10.5px semibold capitals: NAME, LOCATION (CONTENTS on Spaces, and no such column on All), FOLDER, BRANCH, STATUS. A 1px divider sits left of every head but NAME.
  - Rows 30px high, radius 6. The selected row has the theme's selection background; any other row under the pointer has the theme's hover background, as a rail entry does, and the pointer is a hand over every row. Neither applies while a column is being dragged. Left to right:
    - the status glyph;
    - the program's icon in a 30px column (the tab icon on All's tab rows; on Clues, a colored clue label instead: `cmd`, `ssh`, `file`, `term`, `port`, `pid`);
    - the name, with matched letters in the accent color and semibold, and the row you are in now semibold. On All the name is led by its path in dim: `space › tab › ` for a pane or agent, `space › ` for a tab, nothing for a space; matched letters light up in the path too. An agent's last message follows in dim 12px;
    - location ("space › tab") in muted 12px, folder and branch in dim 12px;
    - "needs you" (blocked color) or "finished" (done color) right-aligned in STATUS;
    - a 16px space badge: the space's first letter, white and bold, on the space's color.
  - **Column widths.** LOCATION, FOLDER, BRANCH and STATUS are each as wide as their longest value needs, and the name takes the rest.
    - The longest value is looked for in every row the category lists, whatever is typed, so the columns hold still while typing. Clues has rows only from its search, so there it is the rows found.
    - A column is never narrower than its own head, nor wider than 520px.
    - A row's name needs its indent, its path and itself, and a clue's reason. An agent's last message doesn't count: it shows in what room is left.
    - When they can't all fit, the name comes first: it asks for what it needs, at most half the list's width. Then the folder gives way, down to its head, then the location, then the branch. STATUS never gives way to them, so its words stay whole.
    - A folder too long for its column is cut at its start (`…/payments-api/feat/webhook-retry`), since what tells two paths apart is at their end. Every other cell is cut at its end.
    - On a dialog too narrow even for the heads, LOCATION, FOLDER and BRANCH narrow in proportion to leave the name 200px, or what it asked for if that is less.
  - A linked worktree's space sits indented under its main checkout and reads "repo ⎇ branch".
  - Empty states read "Reading panes…", "Nothing matches" or "Nothing here yet". The exception is All with a query nothing matches, when Clues is one of the visible categories: it shows one selected row, a search glass and `Search Clues for "<query>"`; opening it (Enter or click) switches to Clues and leaves the query in the search field. Otherwise All shows "Nothing matches".
- **Footer**, 28px high on the chrome background with a top border: the keys worth knowing now as small key chips with dim labels (`⏎ open`, `↑↓ move`, `⇥ category`, `⌃S sort` on Agents, `esc close` at the right). A broken `recall.json` shows its error here in the blocked color.

## How it behaves

- **Opening.** It opens on the category asked for, else the one used last, else the first. The selection starts on the first row that isn't where you are now, so Enter goes back; Clues' reason rows ("not in any pane", "nothing listening") are skipped too. When every row is where you are, the first is selected. The same rule picks the row again each time the query changes. It keeps aiming there until you move, because focus can settle after the first frame. Pressing the open key again closes it.
- **Pane name.** A pane has the same name in every category: its agent's title, else the title its program set (unless that is only the terminal's address), else its program's name (`zsh` for a bare shell), else its folder's last segment (only when Herdr doesn't know its program), else, for a mod's pane, the mod.
- **Keys.**

  | Key | Action |
  | --- | --- |
  | Enter | Go to the row: `space.select`, `tab.select` + `pane.focus`, or `agent.focus` |
  | Up / Down, Ctrl+P / Ctrl+N | Move, wrapping around |
  | Tab / Shift+Tab | Next / previous category |
  | Ctrl+S | Agents only: cycle Recent, Priority, Grouped |
  | Escape | Clear the search, then close |
  | Ctrl+C | Close |

  Typing searches. Binding a movement key to a letter in `recall.json` turns on vim-style input: `j` `k` move, `h` `l` switch categories, `/` starts searching, and Escape leaves the search first.
- **Mouse.**
  - Click a row to go there, or a rail entry to switch category.
  - Drag the divider left of a head to set that column's width, between its head's width and 520px. A press that doesn't move sideways changes nothing. Double-click the divider to let the column fit its content again.
    - The columns are first fitted as if nothing had been dragged; a dragged column is then drawn at its width, and the name gives or takes the difference, so the divider stays under the pointer and the other columns stay as they were.
    - The name gives down to 200px, or to what it asked for if that is less. Past that, the columns that weren't dragged give way, the folder first, and a dragged column narrows only after them, never past its head. While that happens a dragged divider may not sit under the pointer.
    - Dragged widths are kept for next time, for the columns dragged only, as designed-size px, so a kept width scales with the text.
- **Text size and font.** The dialog follows Herdr's interface text size (`settings().ui_font_size`, 13px today) and interface font. In `recall.json`, `font_size` gives it a size of its own (the size of a row's name, in px at zoom 1) and `font` a family of its own. Everything in the dialog is drawn at that size ÷ 13 of its design: text, rows, icons, column widths and spacing. The 1px borders and the dialog's own size stay. The scale is held between 0.5 and 3, the range of Herdr's zoom, which still multiplies on top as it does for every mod. A `font_size` that isn't a positive number, or a `font` the machine doesn't have, is ignored without an error.
- **All.** One row per destination:
  - every agent, standing for the pane it runs in;
  - every pane without an agent;
  - every tab with more than one pane;
  - every space with more than one tab, and no space rows at all when there is only one space.

  With nothing typed, agents and panes come first, then tabs, then spaces. Within each, the focused rows come first, most recently focused first, then the never-focused ones by status: blocked, done, working, idle, none, ties in Herdr's order. Typing filters that same list, so it only shrinks, and the count reads `n/total` with the untyped total.
- **Agent status.**
  - working: a spinner in the working color;
  - blocked: a ● in the blocked color, plus "needs you";
  - done: a ● in the done color, plus "finished";
  - idle: a ○.

  In every category, Recent puts the focused rows first, most recently focused first, then the never-focused ones by status (blocked, done, working, idle, none), ties in Herdr's order; a linked worktree space still nests under its main checkout. Agents sort by Recent (that rule), Priority (blocked, done, working, idle; latest change first within each) or Grouped (Herdr's own space, tab and pane order).
- **Search.** fzf's extended-search syntax (see Query syntax below), every term matching some field:
  - spaces by name, folder, branch, machine and status word;
  - tabs by name, what they run, their space, folder, their panes, branch and status word;
  - panes and agents by name, "space › tab", folder, program, branch and status word.

  The status word is what the STATUS column shows: "needs you" for blocked, "finished" for done. An agent's last message is not searched. Matching a branch, status word or machine highlights nothing; letters light up only in the name and path.

  All searches each row as its own category does. Typing sorts the matches into two tiers (ADR 0002):
  - first the rows where every term appears unbroken (as one run of letters, smart case) in some field, then the rest;
  - each tier keeps the order the list had with nothing typed: All's resting order, recency, or on Agents the chosen sort (Recent, Priority or Grouped). So one more letter never swaps two rows that stay in one tier;
  - the fuzzy score orders nothing, and the name gets no bonus. It only places highlights: a term that appears unbroken lights that run (the best-placed one, at a word start if there is one), else its best fuzzy alignment; when fields tie, the name wins.

  Query syntax, as fzf 0.73's extended-search mode, which is the reference for edge cases:
  - terms split on whitespace and all must match; `\ ` is a literal space;
  - `'abc` matches `abc` unbroken; `'abc'` matches it with both ends at word boundaries (next to the field's edge or a character that is neither a letter nor a digit, `_` included), so `'api'` matches `payments-api` and not `rapid`;
  - `^abc` and `abc$` anchor to the start or end of any one field (fzf has one line, a row has several); `^abc$` matches a field that is `abc`;
  - `!abc` drops rows where `abc` appears unbroken in any field; `!^abc`, `!abc$` and `!'abc'` negate those kinds, and `!'abc` negates a fuzzy match, as in fzf;
  - `|` between terms means OR, binding tighter than the spaces between groups; a `|` with no term before it is a term, and one at the end is ignored;
  - an operator with nothing after it (`!`, `'`, `^`) filters nothing yet;
  - smart case: a term with an uppercase letter matches case exactly.

  With the tiers: exact and anchored terms count as unbroken, negated terms don't count, and in an OR group the alternative that matched decides (one that appears unbroken, if several match). Negated terms highlight nothing.

  Clues keeps its own order. On Clues:
  - a plain query also finds text panes printed;
  - a prefix and one space narrows it: `cmd`, `ssh`, `file`, `term`, `port`, `pid`;
  - `.` searches only printed text;
  - the text after a prefix uses the query syntax: on commands and ssh hosts as anywhere, and on printed text line by line, where a plain term must appear as typed (as if quoted), every term must hold in the same line, and `^` and `$` hold at the line's ends. The row shows the first such line, around the first term that matched; `port` and `pid` take a number;
  - `ws`, `tab` and `pane` are plain text, not list switches, and a pane's folder is no clue (All and Panes search it);
  - with nothing typed it lists each pane's command and ssh clues.

  Clues re-reads what panes run every 10 s and the buffers of new panes every 30 s while it shows.
- **Jumping back without the dialog.** `recall.previous-tab`, `-pane`, `-agent` and `-space` go to the most recently focused one that still exists and isn't where you are, across spaces.

## Built from

- **One mod**, `mods/recall/`:
  - `mod.json`: `{ "place": "none", "title": "Recall", "overlay": { "kind": "dialog", "width": 0.74, "height": 0.7 } }`;
  - `main.js`: the view and its state;
  - `ui.js`: the drawing, tested by the command below against a stand-in for Herdr's runtime (`tests/herdr-runtime.mjs`);
  - `lib/`: pure functions, tested with `node --test 'tests/*.test.mjs'`:
    - `listview.js` for what a category shows: its rows with their highlights, the total and the opening selection;
    - `items.js` for the rows of each category, All's included;
    - `clues.js` and `clue-extract.js` for Clues;
    - `fuzzy.js` for search;
    - `mru.js` for recency;
    - `config.js` for `recall.json`;
    - `columns.js` for location text, the room each column needs and how wide it is drawn;
    - `textwidth.js` for how wide a text is drawn;
    - `look.js` for the text scale and the font;
    - `tracker.js` for the tracker's window;
    - `worktrees.js` for worktree grouping;
  - `icons/`: `spaces`, `tabs`, `panes`, `agents`, `all` and `search` SVGs (`search` is Clues' icon and the search field's).
- **Two roles of one mod**, told apart by `props().role`:
  - **The tracker** is a kept, frameless window, 2px a side (`key: "recall-tracker"`, `keep: true`). It carries its size in its props; a tracker kept at another size reopens itself at this one. Its render records every focus change, as space, tab, pane and agent, into shared `recall.history`. It answers `recall.open`, `recall.open-<category>`, `recall.open-agents-<sort>` and `recall.previous-*` from `nextCommand()`.
  - **The navigator** is the dialog. Opening it opens the tracker, so one open starts tracking.
- **A `keys.json` snippet**, merged into the person's keys:

  ```json
  { "global": { "cmd-e": "mod.open:recall" } }
  ```

- **`herdr` functions:** `spaces`, `panes`, `agents`, `terminals`, `focused`, `theme`, `settings`, `fonts`, `props`, `run`, `shared`, `setShared`, `openOverlay`, `closeOverlay`, `nextCommand`, `home`, `appHome`, `readTextFile`, `exec`, `hc`.
- **Commands run:** `space.select`, `tab.select`, `pane.focus`, `agent.focus`.
- **Shared state:**
  - `recall.history`: recency;
  - `recall.open`: the open dialog's heartbeat, every 1.5 s;
  - `recall.last`: the last category;
  - `recall.widths`: the widths of the columns the person dragged;
  - `recall.look`: the font and size `recall.json` asked for last time;
  - it reads `space.colors`, as Herdr's own mods keep it, so badges match the sidebar.
- **Programs run** (all local; nothing reaches the network):
  - `git -C <folder> rev-parse --path-format=absolute --show-toplevel --git-common-dir` for each local space, to find worktrees;
  - for Clues: `hc get <t> --json` and `hc read <t> --lines 3000` for each terminal, `ps -eo pid=,ppid=,command=`, and `lsof -nP -iTCP -sTCP:LISTEN -F pn` (else `/usr/sbin/lsof`).
- **Settings:** `~/.config/herdr-app/recall.json`, optional:
  - `categories`: which categories show, in order: `all`, `spaces`, `tabs`, `panes`, `agents`, `clues` by default, with `workspaces`, `workspace` and `ws` read as `spaces`, `others` read as `clues` (as are `recall.open-others` and `recall.open-clues`), unknown names dropped, the first of a duplicate kept and an empty list showing only All; `tabs`, the earlier name, is read only when `categories` is absent;
  - `keybindings`: `next_category`, `previous_category`, `move_up`, `move_down`, `select`, `dismiss`, `force_quit` and `backspace`, each a list of keys in Herdr's spelling or `C-p` / `S-Tab` style;
  - `font_size` and `font`: the dialog's own text size and font family (see Text size and font).
- **Art:** the six icons above, and the spinner from the shipped `mods/workspace-chrome/spinner.svg`.

## Watch out

- **Install by copying the folder, not symlinking it.** Herdr loads a mod's icons only from inside its home folder, so a symlinked copy runs without icons.
- **Copies of a mod share no memory.** The dialog announces itself in shared `recall.open` with a heartbeat. A second open within 4 s is a toggle, and a crash leaves nothing stuck.
- **The search field takes keys before `on_key_down` does,** and so does Tab focus traversal. Bind the category and close keys with `cx.bind_keys` in both `RecallNavigator` and `RecallNavigator > Input`, and handle them with `on_action`. Printable keys stay with `on_key_down`, since whether they type or move depends on the mode.
- **Focus the search field again 250 ms after opening.** The first focus can be lost.
- **Use `v_virtual_list` with the row's height (30px, to scale) and `track_scroll`, not `uniform_list`.** A `uniform_list` ignores `track_scroll` (`herdr-app check` warns about it), so `scroll_to_item` does nothing and a selection moved past the visible rows goes off screen.
- **Give every element with a `hover` style an `id`, each row its own.** Herdr draws a frame for a pointer that crosses onto an element only when the element has one. Without it the hover background still shows, but only on the next frame something else asks for (the search field's cursor blinks about twice a second), so the light trails the pointer by up to half a second.
- **The dialog only hears pointer moves while the pointer is over it.** A column resize ends when the pointer leaves the dialog.
- **The tracker only records from its first open.** Recency starts empty after installing.
- **Give the tracker's window a size above 1.** Herdr reads an overlay's width or height of 1 or less as a share of its own window, and a window overlay keeps the scrolls and presses over it. At 1 × 1 the tracker covers the whole window, unseen: clicks on spaces and panes do nothing, the wheel doesn't scroll terminals, and any drag moves the tracker instead.
- **The dialog's size is fixed by `mod.json`.** Larger text, or a higher zoom, leaves fewer rows and less width. Give the name column its minimum width and let LOCATION, FOLDER and BRANCH shrink, or they squeeze the name out on a small window.
- **Herdr gives a mod no way to measure text.** Work a text's width out from its characters: sum Geist's widths per character, as Herdr lays them out (measure them by drawing each one ten times in a box and reading a screenshot), and add 2% and 1px, since the sums come out up to 1.5% under what is drawn. Semibold is as wide as regular. When the dialog is drawn in another font, count each letter as 0.62 of the text size and a CJK character as the text size.
- **Nothing tells the dialog its own width either.** The list is the dialog's 74% of `window.viewport_size().width`, divided by Herdr's zoom (the zoom enlarges what is in the window, not the window), less 2px of border, divided by the dialog's scale, less the 60px rail. A row then spends 24px on its ends, 56px on its status glyph, icon and badge, and 8px on each gap.
- **`recall.json` is read after the first frame.** Keep the font and size it asked for in shared `recall.look` and draw the first frame from that, or the dialog opens at Herdr's size and jumps.
- **Disclose before installing:** the mod runs programs (`exec`, `hc`) and reads terminal buffers. It reads nothing outside the app home besides what those programs report.

## Done when

- `herdr-app check mods/recall` passes, and `node --test 'tests/*.test.mjs'` passes.
- After the first `⌘E`, going from tab A to tab B and pressing `⌘E` opens with A's row selected, and Enter returns to A. Pressing `⌘E` twice closes the dialog.
- With the tracker running, a click on a space still switches to it and the wheel still scrolls a terminal; `windows.json` keeps `recall-tracker` at 2 × 2.
- `recall.previous-tab` jumps back to the previous tab even when it is in another space.
- On Agents, a blocked agent reads "needs you" and Ctrl+S cycles Recent, Priority and Grouped.
- Clicking a column head changes nothing: no sort, no ▲ or ▼.
- With nothing dragged, a category whose longest values fit beside the name shows every one of them whole, and typing doesn't move the columns.
- Dragging LOCATION's divider widens it; the width is still there after reopening, and a double-click lets it fit its content again.
- With `"font_size": 19.5` in `recall.json`, the dialog draws everything one and a half times as large, from its first frame once it has been opened before; without it, the dialog looks as it does at 13px.
- On a window too narrow for every column, or at a high zoom, the name still shows, the folder is cut at its start before the location or the branch narrow, every column is lined up under its head, and "needs you" is whole.
- All lists each pane or agent once, led by its `space › tab › ` path, with no LOCATION column; a tab with one pane and a space with one tab have no row of their own.
- In Clues, `port <n>` for a running dev server lists the pane that started it.
- Typing puts rows where the term appears unbroken above rows that match by scattered letters, each group in its untyped order, and the selection skips the row you are on unless it is the only match.
- On All, `^pay` finds the rows located in a space named `payments-api`, `'api'` doesn't find a pane titled `rapid`, and `!zsh` drops the shell panes.
