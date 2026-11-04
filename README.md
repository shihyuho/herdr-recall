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

An IntelliJ-style "Recent" switcher for the [Herdr](https://herdr.dev/) app. One key lists your spaces, tabs, panes and agents, most recently focused first, and opens on the one you were in just before this one: press `⌘E`, then `⏎`, and you're back where you were a moment ago.

![Recall's Agents list: a blocked agent reads "needs you", a finished one "finished"](preview.png)

Each row shows where it lives, its folder, its branch and whether an agent there needs you. Type to fuzzy-search, and drag a column's edge to resize it.

The **All** list finds a pane by what it runs, the host it is ssh'd into, the file it has open, the port it listens on, or text it printed: `port 5173` finds the pane that started your dev server. To do that, Recall runs `git`, `ps` and `lsof` and reads pane buffers on your machine; nothing leaves it.

## Install

Recall needs the Herdr app, with `herdr-app` on your `PATH`.

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

**To update,** pull the repo (or clone it again) and re-run `./install.sh`. It replaces `mods/recall/` and keeps your history and column widths, which Herdr stores outside that folder. If you installed with your agent, ask it to do those two steps: Herdr tells agents never to overwrite a mod, so asking it to add Recall again gives you a second, renamed copy instead of an update.

To remove Recall, delete `~/.config/herdr-app/mods/recall` and the keys you bound to it.

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
| Drag the line left of a column head | Resize that column; double-click the line to reset it |

Pressing the open key again closes the switcher, or switches to the category that key opens. Column widths are kept.

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

Bind them in `keys.json` like `mod.open:recall` above. They work once the tracker runs, so after the first time you open the switcher.

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

- `tabs`: which categories show, in this order. The switcher opens on the one used last, else the first.
- `keybindings`: `next_category`, `previous_category`, `move_up`, `move_down`, `select`, `dismiss`, `force_quit`, `backspace`. Binding a movement key to a letter, as above, turns on vim-style input: `j` `k` move, `h` `l` switch categories, `/` starts searching.
- Keys use Herdr's spelling (`ctrl-p`, `shift-tab`) or herdr-recent-navigator's (`C-p`, `S-Tab`), so a config from there works as it is.

</details>

## Support

If herdr-recall helps you, you can support its maintenance through [Buy Me a Coffee](https://buymeacoffee.com/methodho).

## License

[MIT](LICENSE) © Shihyu Ho
