<p align="center">
  <img src="assets/icon.svg" alt="herdr-recall" width="120" />
</p>

<h1 align="center">herdr-recall</h1>

<p align="center"><strong>那個 agent 剛剛在哪個 tab？</strong></p>

<p align="center">
  <a href="https://herdr.dev/"><img src="https://img.shields.io/badge/Herdr-mod-df372b" alt="Herdr mod"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <b>繁體中文</b>
</p>

[Herdr](https://herdr.dev/) app 的 IntelliJ 風格「Recent」切換器。一個鍵列出所有 space、tab、pane 與 agent，最近用過的排最前面，並停在你上一個待過的位置，按 `⏎` 就回去了。

每一列都標出它在哪、所在資料夾、branch，以及那裡的 agent 是否在等你。打字即可模糊搜尋，點欄位標題可以排序，拖曳欄位邊緣可以調整寬度。

**All** 清單能用 pane 正在跑的指令、ssh 連到的主機、開著的檔案、監聽的 port，或印出過的文字找到它。為此 Recall 會在你的電腦上執行 `git`、`ps`、`lsof` 並讀取 pane 的內容，資料不會離開你的電腦。

## See it in action

**你按下**

> `⌘E` `⏎`

**你回到了**

> 剛剛待過的那個 tab，不管它在哪個 space。

**你在 All 輸入**

> `port 5173`

**你找到了**

> 啟動 dev server 的那個 pane。

## Install

```bash
git clone https://github.com/shihyuho/herdr-recall.git
cd herdr-recall
./install.sh
```

接著在 `~/.config/herdr-app/keys.json` 綁定按鍵：

```json
{
  "global": {
    "cmd-e": "mod.open:recall",
    "ctrl-s t": "recall.previous-tab"
  }
}
```

也可以請 Herdr 裡的 agent 加入 `github.com/shihyuho/herdr-recall` 這個 mod：它會把 `mods/recall/` 複製到位、把上面的按鍵合併進你的設定（要取代你已經在用的按鍵前會先問），並執行 `herdr-app check`。

不論用哪種方式，先按一次 `⌘E`。這會啟動 Recall 的 tracker，從此記錄每一次切換焦點，之後每次啟動 Herdr 都會自動帶起來。用腳本安裝的話，更新時 pull 後重新執行 `./install.sh`。

<details>
<summary><strong>切換器裡的按鍵</strong></summary>

| 按鍵 | 作用 |
| --- | --- |
| `⏎` | 前往這一列 |
| `↑` `↓`、`⌃P` `⌃N` | 移動 |
| `⇥` `⇧⇥` | 下一個／上一個分類 |
| `⌃S` | Agents：依最近、優先度或分組排序 |
| `Esc` | 先清掉搜尋，再關閉 |
| `⌃C` | 關閉 |

再按一次開啟的按鍵會關閉切換器；如果那個按鍵開的是別的分類，就切換過去。

</details>

<details>
<summary><strong>可綁定的指令</strong></summary>

| 指令 | 作用 |
| --- | --- |
| `recall.open` | 開在上次用的分類 |
| `recall.open-<category>` | 開在 `spaces`、`tabs`、`panes`、`agents` 或 `all` |
| `recall.open-agents-<sort>` | 開在 agents，依 `recent`、`priority` 或 `grouped` 排序 |
| `recall.previous-tab` | 跳回上一個 tab，可跨 space |
| `recall.previous-pane` | 跳回上一個 pane |
| `recall.previous-agent` | 跳回上一個 agent |
| `recall.previous-space` | 跳回上一個 space |

`mod.open:recall` 會直接開啟切換器；`recall.*` 指令則透過 tracker 送達。

</details>

<details>
<summary><strong>在 All 裡搜尋</strong></summary>

一般的搜尋會比對 pane 正在跑的東西、它的位置，以及它印出過的文字。前綴加一個空格可以縮小範圍：

| 前綴 | 用什麼找 pane |
| --- | --- |
| `cmd ` | 正在執行的指令 |
| `ssh ` | ssh 連到的主機 |
| `cwd ` | 工作目錄 |
| `file ` | 執行編輯器的 pane 裡的文字；單獨輸入時，列出各自開著的檔案 |
| `term ` | 一般終端機 pane 裡的文字 |
| `port ` | 它的 shell 底下的程序所監聽的 port |
| `pid ` | 它的 shell 所啟動的程序的 process ID |
| `.` | 只比對印出過的文字 |

`ws `、`tab `、`pane ` 會切換到對應的清單。

</details>

<details>
<summary><strong>設定</strong></summary>

`~/.config/herdr-app/recall.json` 的每個欄位都可省略：

```json
{
  "tabs": ["spaces", "tabs", "panes", "agents", "all"],
  "keybindings": {
    "move_up": ["k", "up"],
    "move_down": ["j", "down"]
  }
}
```

- `tabs`：要顯示哪些分類，以及它們的順序。
- `keybindings`：`next_category`、`previous_category`、`move_up`、`move_down`、`select`、`dismiss`、`force_quit`、`backspace`。像上面這樣把移動鍵綁成字母，就會切換成 vim 式輸入：`j` `k` 移動，`h` `l` 切換分類，`/` 開始搜尋。
- 按鍵可以用 Herdr 的寫法（`ctrl-p`、`shift-tab`），也可以用 herdr-recent-navigator 的寫法（`C-p`、`S-Tab`），所以那邊的設定可以直接搬過來用。

</details>

## Related Projects

- [Herdr](https://herdr.dev/)，Recall 所屬的 app。更多 mod 請見 [herdr.dev/mods](https://herdr.dev/mods)。

## Support

如果 herdr-recall 對你有幫助，可以透過 [Buy Me a Coffee](https://buymeacoffee.com/methodho) 支持它的維護。

## License

[MIT](LICENSE) © Shihyu Ho
