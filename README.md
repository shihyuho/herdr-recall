<p align="center">
  <img src="assets/icon.svg" alt="herdr-recall" width="120" />
</p>

<h1 align="center">herdr-recall</h1>

<p align="center"><strong>Which tab was that agent in again?</strong></p>

<p align="center">
  <a href="https://herdr.dev/"><img src="https://img.shields.io/badge/Herdr-mod-df372b" alt="Herdr mod"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

<p align="center">
  <b>English</b> ·
  <a href="README.zh-TW.md">繁體中文</a>
</p>

An IntelliJ-style "Recent" switcher for the [Herdr](https://herdr.dev/) app. One key lists your spaces, tabs, panes and agents, most recently focused first, and opens on the one you were in just before this one, so `⏎` takes you back.

Each row shows where it lives, its folder, its branch and whether an agent there needs you. Type to fuzzy-search, click a column head to sort by it, and drag a column's edge to resize it.

The **All** list finds a pane by what it runs, the host it is ssh'd into, the file it has open, the port it listens on, or text it printed. To do that, Recall runs `git`, `ps` and `lsof` and reads pane buffers on your machine; nothing leaves it.

## See it in action

**You press**

> `⌘E` `⏎`

**You're back**

> in the tab you were in a moment ago, in whichever space it was.

**You type**, in All

> `port 5173`

**You find**

> the pane whose shell started your dev server.

## Install

```bash
git clone https://github.com/shihyuho/herdr-recall.git
cd herdr-recall
./install.sh
```

Then bind a key in `~/.config/herdr-app/keys.json`:

```json
{
  "global": {
    "cmd-e": "mod.open:recall",
    "ctrl-s t": "recall.previous-tab"
  }
}
```

Or ask your agent in Herdr to add the mod at `github.com/shihyuho/herdr-recall`: it copies `mods/recall/` into place, merges these keys into yours (asking before it replaces one you already use), and runs `herdr-app check`.

Either way, press `⌘E` once. That starts Recall's tracker, which records every focus change from then on and comes back on every start. To update an install made with the script, pull and re-run `./install.sh`.

<details>
<summary><strong>Keys in the switcher</strong></summary>

| Key | Does |
| --- | --- |
| `⏎` | Go to the row |
| `↑` `↓`, `⌃P` `⌃N` | Move |
| `⇥` `⇧⇥` | Next / previous category |
| `⌃S` | Agents: sort by recent, priority or grouped |
| `Esc` | Clear the search, then close |
| `⌃C` | Close |

Pressing the open key again closes the switcher, or switches to the category that key opens.

</details>

<details>
<summary><strong>Commands to bind</strong></summary>

| Command | Does |
| --- | --- |
| `recall.open` | Open on the last category used |
| `recall.open-<category>` | Open on `spaces`, `tabs`, `panes`, `agents` or `all` |
| `recall.open-agents-<sort>` | Open on agents sorted by `recent`, `priority` or `grouped` |
| `recall.previous-tab` | Jump back to the previous tab, across spaces |
| `recall.previous-pane` | Jump back to the previous pane |
| `recall.previous-agent` | Jump back to the previous agent |
| `recall.previous-space` | Jump back to the previous space |

`mod.open:recall` opens the switcher directly; the `recall.*` commands reach it through the tracker.

</details>

<details>
<summary><strong>Searching All</strong></summary>

A plain query matches anything a pane runs, where it is, and what it printed. A prefix followed by one space narrows it:

| Prefix | Finds panes by |
| --- | --- |
| `cmd ` | The command running in them |
| `ssh ` | The host they are ssh'd into |
| `cwd ` | Their working folder |
| `file ` | Text in panes running an editor; alone, the file each has open |
| `term ` | Text in panes that are plain terminals |
| `port ` | A port their shell's processes listen on |
| `pid ` | The process ID of something their shell started |
| `.` | Only the text they printed |

`ws `, `tab ` and `pane ` switch to those lists.

</details>

<details>
<summary><strong>Settings</strong></summary>

Every key in `~/.config/herdr-app/recall.json` is optional:

```json
{
  "tabs": ["spaces", "tabs", "panes", "agents", "all"],
  "keybindings": {
    "move_up": ["k", "up"],
    "move_down": ["j", "down"]
  }
}
```

- `tabs`: which categories show, in this order.
- `keybindings`: `next_category`, `previous_category`, `move_up`, `move_down`, `select`, `dismiss`, `force_quit`, `backspace`. Binding a movement key to a letter, as above, turns on vim-style input: `j` `k` move, `h` `l` switch categories, `/` starts searching.
- Keys use Herdr's spelling (`ctrl-p`, `shift-tab`) or herdr-recent-navigator's (`C-p`, `S-Tab`), so a config from there works as it is.

</details>

## Related Projects

- [Herdr](https://herdr.dev/), the app Recall is a mod for. More mods at [herdr.dev/mods](https://herdr.dev/mods).

## Support

If herdr-recall helps you, you can support its maintenance through [Buy Me a Coffee](https://buymeacoffee.com/methodho).

## License

[MIT](LICENSE) © Shihyu Ho
