<p align="center">
  <a href="https://shihyuho.github.io/herdr-recall/">
    <img src="assets/icon.svg" alt="herdr-recall" width="120" />
  </a>
</p>

<h1 align="center">herdr-recall</h1>

<p align="center"><strong>Which tab was that agent in again?</strong></p>

<p align="center">
  <a href="https://herdr.dev/"><img src="https://img.shields.io/badge/Herdr-mod-df372b" alt="Herdr mod"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://shihyuho.github.io/herdr-recall/"><img src="https://img.shields.io/badge/live_demo-df372b" alt="Live demo"></a>
</p>

<p align="center">
  <b>English</b> ·
  <a href="README.zh-TW.md">繁體中文</a>
</p>

A recent + fuzzy switcher for the [Herdr](https://herdr.dev/) app, in the spirit of IntelliJ's "Recent", searched with [fzf](https://github.com/junegunn/fzf)'s syntax. Press `⌘E`, then `⏎`, and you're back where you were a moment ago.

![Recall's Agents list filtered by "red": "Plan the Redis upgrade" matches unbroken and comes first, then the rows that match only by scattered letters](preview.png)

- **Back in two keys.** `⌘E` lists every space, tab, pane and agent, most recent first, and opens on the one you were in just before this one, so `⏎` takes you back.
- **Agents that need you stand out.** Each row shows where it lives, its folder, its branch, and whether an agent there needs you or has finished. Rows you have never been to follow the ones you have, those that need you first.
- **Fuzzy search, fzf syntax.** Type to narrow any list by anything a row shows: its name, where it lives, folder, branch, "needs you" or "finished", a remote space's machine. `'exact`, `'whole-word'`, `^start`, `end$`, `!exclude` and `this | that` work as in fzf (see **Search syntax** below). Rows where every term appears unbroken come first, and both groups keep the list's own order, so rows don't trade places as you type.
- **Find a pane by what it's doing.** In Clues, `port 5173` finds the pane that started your dev server. It also finds a pane by the command it runs, the host it is ssh'd into, the file it has open or the text it printed. To do that, Recall runs `git`, `ps` and `lsof` and reads pane buffers on your machine; nothing leaves it.

## Install

Recall needs the Herdr app, with `herdr-app` on your `PATH`. It was tested with Herdr 0.1.15; that is the version it was tried on, not a minimum, and the install script checks no version.

**With your agent.** Ask your agent in Herdr to add the mod at `github.com/shihyuho/herdr-recall`. It copies `mods/recall/` into place, adds the `⌘E` key from [`keys.json`](keys.json) to yours (asking first if you already use it), and runs `herdr-app check`.

**With the script.** It needs `rsync`.

```bash
git clone https://github.com/shihyuho/herdr-recall.git
cd herdr-recall
./install.sh
```

Then bind a key in `~/.config/herdr-app/keys.json`:

```json
{
  "global": {
    "cmd-e": "mod.open:recall"
  }
}
```

`cmd-e` is `⌘E` on macOS; elsewhere, pick a key you don't use yet.

**Then, either way,** press that key once. It starts Recall's tracker, which records every focus change from then on and comes back each time Herdr starts.

**To update,** pull the repo (or clone it again) and re-run `./install.sh`. It replaces `mods/recall/` and keeps your history and the column widths you dragged, which Herdr stores outside that folder. If you installed with your agent, ask it to do those two steps: Herdr tells agents never to overwrite a mod, so asking it to add Recall again gives you a second, renamed copy instead of an update.

To remove Recall, delete `~/.config/herdr-app/mods/recall` and the keys you bound to it.

<details>
<summary><strong>Lists and order</strong></summary>

Six lists sit on the left, in this order: All, Spaces, Tabs, Panes, Agents and Clues (`categories` under **Settings** picks which show).

**With nothing typed,** each list puts the rows you have been to first, most recently focused first. Rows you have never been to follow, those that need you first: blocked, then done, working, idle. In Agents, `⌃S` switches this Recent order to Priority (by status, latest change first) or Grouped (as Herdr lists them).

**Typing** sorts the matches into two tiers: first the rows where every term you typed appears unbroken, then the ones that match only by scattered letters. Each tier keeps the order the list had with nothing typed (in Agents, the sort you chose), so rows don't trade places as you type.

**The selection** starts on the first row that isn't where you are now, typed or not, so `⏎` takes you somewhere else; when the row you are on is the only match, it is selected.

**All** has every space, tab, pane and agent in one place, so you can find something without knowing what kind it is. Each name is led by its path (`payments-api › refunds › nvim`), and each destination appears once: an agent stands for its pane, a tab gets its own row only when it has several panes, and a space only when it has several tabs. Agents and panes come first, then tabs, then spaces, each in the order above. When nothing in All matches and Clues is one of your categories, it offers one row, `Search Clues for "<query>"`; opening it switches to Clues with the same query. Without Clues, and in the other lists, it just says "Nothing matches".

**Clues** puts the most recently focused pane first, and typing there doesn't use the tiers; see **Searching Clues** below.

</details>

<details>
<summary><strong>Keys and mouse</strong></summary>

| Key | Does |
| --- | --- |
| `⏎` | Go to the row |
| `↑` `↓`, `⌃P` `⌃N` | Move |
| `⇥` `⇧⇥` | Next / previous category |
| `⌃S` | Agents: sort by recent, priority or grouped |
| `Esc` | Clear the search, then close |
| `⌃C` | Close |

| Mouse | Does |
| --- | --- |
| Click a row | Go to it |
| Click a category on the left | Switch to it |
| Drag the line left of a column head | Set that column's width; double-click the line to let it fit its content again |

Pressing the open key again closes the switcher, or switches to the category that key opens.

Each column is as wide as its longest value in the category you are in, so the columns hold still while you type. Clues has rows only from its search, so there they fit the rows found. When they can't all fit, the name comes first, up to half the list. Then the folder narrows, cut at its start so its end still shows, then the location, then the branch. The status column doesn't give way to them. A column you dragged stays at that width, taking the room from the name or giving it back, and the width is kept.

</details>

<details>
<summary><strong>Commands to bind</strong></summary>

| Command | Does |
| --- | --- |
| `recall.open` | Open on the last category used |
| `recall.open-<category>` | Open on `all`, `spaces`, `tabs`, `panes`, `agents` or `clues` (`others` opens Clues too) |
| `recall.open-agents-<sort>` | Open on agents sorted by `recent`, `priority` or `grouped` |
| `recall.previous-tab` | Jump back to the previous tab, across spaces |
| `recall.previous-pane` | Jump back to the previous pane |
| `recall.previous-agent` | Jump back to the previous agent |
| `recall.previous-space` | Jump back to the previous space |

Bind them in `keys.json` like `mod.open:recall` above. They work once the tracker runs, so after the first time you open the switcher.

</details>

<details>
<summary><strong>Search syntax</strong></summary>

Queries follow fzf's extended-search mode, in every list. Terms are separated by spaces, and every term must match, each in any one field of a row (its name, where it lives, its folder and so on).

| Term | Keeps rows where |
| --- | --- |
| `abc` | a field has a, b and c in that order (fuzzy) |
| `'abc` | a field has `abc` unbroken |
| `'abc'` | a field has `abc` as a whole word, so `'api'` finds `payments-api` but not `rapid` |
| `^abc` | a field starts with `abc` |
| `abc$` | a field ends with `abc` |
| `^abc$` | a field is `abc` |
| `!abc` | no field has `abc` unbroken; `!^abc`, `!abc$` and `!'abc'` exclude those matches, and `!'abc` excludes fuzzy ones |
| `abc \| def` | either term matches |

`\ ` stands for a space inside a term. A lowercase term ignores case; one with an uppercase letter matches case exactly. Where fzf matches one line, a row here has several fields, so `^` and `$` hold at the start or end of any one of them: `^pay` finds the rows located in `payments-api`, and `refunds$` the ones in its `refunds` tab.

Exact and anchored terms count as unbroken, so they put their rows in the upper tier. Negated terms don't change the tier and highlight nothing. In an OR group, the term that matched decides; when several match, one that appears unbroken wins.

</details>

<details>
<summary><strong>Searching Clues</strong></summary>

A plain query matches anything a pane runs and what it printed. With nothing typed, Clues lists each pane's command and ssh clues. A pane's folder is not a clue; search it in All or Panes. A prefix followed by one space narrows it:

| Prefix | Finds panes by |
| --- | --- |
| `cmd ` | The command running in them |
| `ssh ` | The host they are ssh'd into |
| `file ` | Text in panes running an editor; alone, the file each has open |
| `term ` | Text in panes that are plain terminals |
| `port ` | A port their shell's processes listen on |
| `pid ` | The process ID of something their shell started |
| `.` | Only the text they printed |

The text after a prefix uses the search syntax above: `cmd !nvim` lists the commands that aren't nvim, `cmd ^npm` the ones that start with npm. In printed text, each term must appear as typed (never by scattered letters), all in one line: `.FAIL !flaky` finds a line with FAIL and without flaky, and `^` and `$` hold at the line's start and end. `port ` and `pid ` take a number.

To switch lists, use the categories (`⇥` / `⇧⇥`); `ws `, `tab ` and `pane ` are searched as plain text.

</details>

<details>
<summary><strong>Settings</strong></summary>

Every key in `~/.config/herdr-app/recall.json` is optional:

```json
{
  "categories": ["all", "spaces", "tabs", "panes", "agents", "clues"],
  "keybindings": {
    "move_up": ["k", "up"],
    "move_down": ["j", "down"]
  },
  "font": "JetBrains Mono",
  "font_size": 15
}
```

- `categories`: which categories show, in this order. The switcher opens on the one used last, else the first. An empty list shows only All; unknown names are dropped and the first of a duplicate is kept. `workspaces`, `workspace` and `ws` mean `spaces`, and `others`, herdr-recent-navigator's name, means `clues`. `tabs`, the earlier name, is still read when `categories` is absent.
- `keybindings`: `next_category`, `previous_category`, `move_up`, `move_down`, `select`, `dismiss`, `force_quit`, `backspace`. Binding a movement key to a letter, as above, turns on vim-style input: `j` `k` move, `h` `l` switch categories, `/` starts searching.
- Keys use Herdr's spelling (`ctrl-p`, `shift-tab`) or herdr-recent-navigator's (`C-p`, `S-Tab`), so a config from there works as it is.
- `font_size`: the size of a row's name, in px at Herdr's zoom 1. Rows, icons, columns and spacing scale with it. Left out, the switcher follows Herdr's interface text size, 13 today. A size below 6.5 or above 39 is held there, and anything that isn't a positive number is ignored.
- `font`: a font family on this machine. Left out, or naming a font the machine doesn't have, the switcher uses Herdr's interface font.

Herdr's zoom still scales the switcher along with everything else. The switcher's own size stays a share of the window, so larger text leaves fewer rows and less room for the columns, which then give way as they do on a small window: the folder first, then the location, then the branch.

</details>

## Support

If herdr-recall helps you, you can support its maintenance through [Buy Me a Coffee](https://buymeacoffee.com/methodho).

## License

[MIT](LICENSE) © Shihyu Ho
