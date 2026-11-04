# Herdr app mod 的發佈與安裝方式

調查日期：2026-11-04。

## 簡短結論

Herdr app 的官方機制是「recipe 加 agent」：作者把 `mods/<name>/`（外加 `RECIPE.md`、`preview.png`、選用的 `keys.json`）放進帶有 topic `herdr-mod` 的公開 GitHub repo，herdr.dev/mods 會自動收錄；使用者請自己的 agent 去加，agent 照 Herdr 內建指引複製資料夾、合併 `keys.json`、跑 `herdr-app check`。官方沒有 `herdr-app` 的 install 子命令（`herdr-app --help` 沒有任何 install 類子命令），所以 `install.sh` 不是官方機制，而是作者自行加上的備援。實際上有 20 / 100 個 `herdr-mod` repo 附 `install.sh`，與 herdr-recall 的做法屬少數但常見。

## 兩個不同的 Herdr（先分清楚）

- **Herdr app（桌面 GUI）**：CLI 是 `herdr-app`，home 是 `~/.config/herdr-app`，mod 是 `mods/<name>/` 內的 JavaScript。來源：`herdr-app --help`（"Home: ~/.config/herdr-app"）、`~/.config/herdr-app/AGENTS.md:81`。
- **herdr（TUI / runtime）**：有自己的 plugin 系統，以 `herdr-plugin.toml` 為 manifest，安裝用 `herdr plugin install <owner>/<repo[/subdir]>`（只接受 GitHub shorthand，會 clone、跑 `[[build]]`、註冊；另有 `update`、`uninstall`、`link`）。來源：https://herdr.dev/docs/plugins/（WebFetch）。`beyondlex/herdr-recent-navigator`（Herdr ≥ 0.7.4）與 `jeffarese/herdr-bar`（Herdr ≥ 0.9.0）都屬這一邊：兩者根目錄都有 `herdr-plugin.toml`（本機 clone：`ghq list -e -p` 解析後 `ls`），README 寫 `herdr plugin install ...`。
- 兩者重疊：少數 repo 同時支援兩邊（見下表「App + TUI」），例如 `mrolafsson/herdr-recap` 的 README 寫 "in the Herdr app ... and in the herdr TUI"，repo 內有 `herdr-plugin.toml`。
- GitHub topic `herdr-plugin` 底下的 repo 屬 TUI 這一邊（例如 `jeffarese/herdr-bar`）；`herdr-mod` 是 app 這一邊。此歸類來自 `gh search repos --topic herdr-plugin` 的結果與抽查，未逐一驗證 100% 屬 TUI。

以下除特別註明外，只談 Herdr app。

## 官方機制

### 分享與收錄

- herdr.dev/mods 的「Share yours」：請 agent 寫 `RECIPE.md`（頁面提供提示詞，要 agent 先讀 `~/.config/herdr-app/AGENTS.md`）；推到公開 GitHub repo、加 topic `herdr-mod`；每個 mod 放 `mods/<name>/`，旁邊有 `RECIPE.md`、`preview.png`、選用的 `keys.json`；一個 repo 可含多個 mod；約一小時內出現在 gallery 的 Community。Herdr 不審核 mod，預覽圖會被篩選。來源：https://herdr.dev/mods（WebFetch）。
- 本機文件同樣說法：`~/.config/herdr-app/AGENTS.md:405-445`，章節 "Layouts and mods other people made"。

### 安裝（由 agent 執行）

`~/.config/herdr-app/AGENTS.md:421-437` 規定 agent 收到「加這個 mod」時的步驟：

1. 先讀 recipe 與每個檔案；若 mod 會連網、執行程式（`exec`、`hc`）或讀自己資料夾以外的檔案，先告知使用者。
2. 把每個 mod 資料夾複製到 `mods/`，recipe 與 preview 不複製；絕不覆蓋，名稱衝突就改名。
3. 只在假設不成立（缺程式、名稱衝突）或使用者要求時才調整；若檔案在此版本不能用，改從 recipe 重建。
4. mod 的 `keys.json`：合併進使用者的；加入其 section 與 key，使用者已用的 key 要先問。
5. 每個 mod 跑 `herdr-app check`。

來源也可為 `herdr.dev/mods/<owner>/<name>` 或 GitHub 資料夾（同檔 :419-421）。

### CLI

`herdr-app --help` 列出的子命令：`ls`、`do`、`feedback`、`commands`、`status`、`shot`、`check <mod folder>`、`--skill`、`--version`。沒有 install / add / mod 管理子命令；`check` 是唯一與 mod 直接相關的（"load a mod once and report what's wrong"）。

### 原始碼與文件

- GitHub org `herdrdev`：`herdr-app`、`herdr-core`、`herdr`、`herdr-layout-examples`、`herdr-nix`（`gh repo list herdrdev`）。
- `herdrdev/herdr-app/docs/mods.md`（`gh api`）只說明「複製 shipped mod 再編輯」與 `herdr-app check`，並指向 `defaults/AGENTS.md`（即寫進 app home 的那份指南）；沒有任何 install 指令。同檔註明 "Mods can run programs, read files and use the network. Only install code you trust."
- `herdrdev/herdr-layout-examples` 是官方範例（"Not official: take them apart"），每個資料夾含 `RECIPE.md`、`preview.png`、`layouts/<name>.json`、`mods/<name>/`，沒有 install 腳本。

### RECIPE.md 必須包含

`~/.config/herdr-app/AGENTS.md:446-470`，依序：

1. `# Name`、一段使用者所見的描述、`![Name](preview.png)`
2. **What you see**：各區域、尺寸、顏色、字型、顯示內容
3. **How it behaves**：每種 agent 狀態、點擊／按鍵／hover 行為
4. **Built from**：node tree、props、使用的 shipped mod、呼叫的 `herdr` 函式與命令、執行的程式、素材
5. **Watch out**：踩過的坑、限制、假設
6. **Done when**：能證明建置成功的檢查

原則：先寫人看到什麼，程式碼只放在 Built from 與 Watch out；精確（`#ab7748`、29px、`agent.focus`）。

### keys.json 與 icon

- `keys.json` 格式與 section（`global`、`layout:<name>`、`terminal`、`mod:<name>`）見 `AGENTS.md:~470-495`；官方預期的是 agent 合併而非覆蓋（:432-433）。
- icon：`AGENTS.md:~768-770` 規定圖片與 SVG 從 `~/.config/herdr-app` 參照，如 `image("mods/<name>/logo.svg")`、`svg("mods/<name>/icon.svg")`。官方文件沒有明講「symlink 不載入 icon」；這點來自社群 README（見下）。
- 熱重載：`AGENTS.md:81` 與 :756 說 `mods/<name>/` 存檔即重載；官方文件未提 symlink 的行為（未驗證官方立場）。

## 實際作者怎麼做

方法：`gh search repos --topic herdr-mod --limit 100` 取得 100 個 repo（剛好達上限，實際可能更多）；對每個用 `gh api repos/<r>/git/trees/HEAD?recursive=1` 檢查檔案、再抓 README 以關鍵字分類。分類為啟發式（regex），不是人工逐篇閱讀；「安裝方式」欄位可能多標。

### 統計（100 個 `herdr-mod` repo）

| 項目 | 數量 | 來源 |
| --- | --- | --- |
| 有 `RECIPE.md` | 98 | tree 掃描 |
| 有 `preview.png` | 98 | tree 掃描 |
| 有 `keys.json` | 42 | tree 掃描 |
| 有 `install.sh` | 20 | tree 掃描 |
| 有 `Makefile` | 2 | tree 掃描 |
| 有 `package.json` | 29（多為 mod 本身的 JS 相依，不等於安裝方式） | tree 掃描 |
| 有 `herdr-plugin.toml`（同時支援 TUI） | 10 | tree 掃描 |
| README 提到 `ln -s` | 6 | README grep |
| README 提到 `herdr-app check` | 66 | README grep |
| README 提到 agent／herdr.dev/mods | 64 | README grep（寬鬆 regex） |
| README 提到 copy／cp -r／rsync | 38 | README grep |
| README 提到 `install.sh` | 15 | README grep |

結論：絕大多數作者遵守官方格式（RECIPE + preview + `mods/<name>/`），安裝說明主流是「請 agent 加」或「手動複製資料夾、合併 `keys.json`」；`install.sh` 約五分之一。

### 典型寫法（逐字或近似引用，來源為各 repo README）

- 只靠官方流程、無腳本：`atuinsh/herdr-atuin-threads` — "copy `mods/atuin-threads/` into `~/.config/herdr-app/mods/`, merge `keys.json` into yours"。
- agent 優先、腳本備援：`mustafaTokmak/herdr-reopen-tab` — 先寫 *"Add the mod at github.com/..."*，再給 `sh install.sh`；其 installer 會 `herdr-app check`、複製到 `~/.config/herdr-app/mods/reopen-tab`、把 `"cmd-shift-t": "mod.open:reopen-tab"` 加進 `keys.json` 且「never replacing a key you already use」。
- 同上，layout：`mirkobozzetto/herdr-app-config` — agent 路線與 `install.sh` 並列，腳本覆蓋前先備份到 `backup-<date>/`。
- 腳本為主：`vinaytiparadi/herdr-mods` — `install.sh`，並註明 repo 同時符合官方分享格式，agent 也能照 herdr.dev/mods 加。
- symlink：`jankeesvw/herdr-issues`、`jankeesvw/herdr-space-folders` 教人 `ln -s`。但 space-folders 自己註明 "Herdr doesn't notice changes inside a symlinked mod folder, so after a `git pull` restart Herdr"；herdr-issues 註明 "Herdr doesn't load images from a symlinked mod folder"，因此把快取圖放在 `data/issues/`。
- 明確反對 symlink：`dmazlum/herdr-doubletap`、`herdr-arena`、`herdr-walkthrough`、`herdr-revive`（"Copy, don't symlink: Herdr doesn't reload a symlinked mod folder"）；`jjongkwann/herdr-files-plus`（"Copy the folder rather than symlinking it, since Herdr may not load the panel's icons from a symlinked mod folder"）；`chappse6/herdr-blueprint-app`、`DnzzL/herdr-automations`、`ernestjsf/herdr-devices`（開發用 sync 腳本複製，因 symlink 不重載）。
- 更新時保留使用者設定：`johnny4young/herdr-relevo` 用 rsync 並 `--exclude config.js`，且「Don't add `--delete`: it removes your own icons」。這與 herdr-recall 的 `rsync --delete` 加 `--exclude` 型別檔相對照。
- TUI plugin：`jeffarese/herdr-bar` 的 `herdr plugin install jeffarese/herdr-bar`、`beyondlex/herdr-recent-navigator` 提供三種（`curl | bash` 的 `install.sh`、`herdr plugin install`、從原始碼 build）。這是 TUI 機制，與 app 的 mod 無關。

### 調查的 repo（全部 100 個 `herdr-mod`）

「Herdr」欄：根目錄有 `herdr-plugin.toml` 者標 App + TUI，其餘標 App（推論，未逐一確認是否也支援 TUI）。「安裝方式」為 README／檔案關鍵字的啟發式分類。

| repo | Herdr | 安裝方式 | RECIPE.md | preview.png | keys.json |
| --- | --- | --- | --- | --- | --- |
| [0xRowdy/herdr-cliproxy](https://github.com/0xRowdy/herdr-cliproxy) | App | agent/recipe | Y | Y | Y |
| [aBER0724/herdr-git-changes](https://github.com/aBER0724/herdr-git-changes) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [Abrahamism/herdr-browser](https://github.com/Abrahamism/herdr-browser) | App + TUI | README: 手動複製, herdr plugin install(TUI) | Y | Y | - |
| [Abrahamism/herdr-opencode-go-usage](https://github.com/Abrahamism/herdr-opencode-go-usage) | App | README: 手動複製 | Y | Y | - |
| [AlekseyBeketov/herdr-app-notifier](https://github.com/AlekseyBeketov/herdr-app-notifier) | App | install.sh, agent/recipe | Y | Y | - |
| [AlonsoSG0/herdr-opencode-usage](https://github.com/AlonsoSG0/herdr-opencode-usage) | App | README: 手動複製 | Y | Y | Y |
| [alvaroroco/herdr-omarchy-theme](https://github.com/alvaroroco/herdr-omarchy-theme) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [amster93/herdr-file-icons](https://github.com/amster93/herdr-file-icons) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [Aryan1092raj/Herdr-pets](https://github.com/Aryan1092raj/Herdr-pets) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [ashrodan/ship-it](https://github.com/ashrodan/ship-it) | App | install.sh, agent/recipe | Y | Y | - |
| [atleugim/herdr-symbols-icons](https://github.com/atleugim/herdr-symbols-icons) | App | README: 手動複製 | Y | Y | - |
| [atuinsh/herdr-atuin-threads](https://github.com/atuinsh/herdr-atuin-threads) | App | README: 手動複製 | Y | Y | Y |
| [aviv-baruch/herdr-containers](https://github.com/aviv-baruch/herdr-containers) | App | install.sh, agent/recipe | Y | Y | Y |
| [ayayaQ/herdr-quick-close](https://github.com/ayayaQ/herdr-quick-close) | App | README: 手動複製 | Y | Y | - |
| [balcsida/herdr-profile-pictures](https://github.com/balcsida/herdr-profile-pictures) | App | README: 手動複製 | Y | Y | - |
| [benjaminsicard/herdr-mods](https://github.com/benjaminsicard/herdr-mods) | App | agent/recipe | Y | Y | - |
| [berkeatac/herdr-usage-bar](https://github.com/berkeatac/herdr-usage-bar) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [CacaoRick/herdr-open-vscode](https://github.com/CacaoRick/herdr-open-vscode) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [cgill27/project-presets](https://github.com/cgill27/project-presets) | App | README: ln -s, README: 手動複製, agent/recipe | Y | Y | Y |
| [chappse6/herdr-blueprint-app](https://github.com/chappse6/herdr-blueprint-app) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [choam2426/herdr-paddock](https://github.com/choam2426/herdr-paddock) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [choam2426/herdr-session-titles](https://github.com/choam2426/herdr-session-titles) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [CiprianSpiridon/herdr-migration](https://github.com/CiprianSpiridon/herdr-migration) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [CiprianSpiridon/herdr-mission-control](https://github.com/CiprianSpiridon/herdr-mission-control) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [CMehlstaeubler/herdr-desk](https://github.com/CMehlstaeubler/herdr-desk) | App | README: ln -s, README: 手動複製, agent/recipe | Y | Y | - |
| [Codesmith28/gruvbox-herdr-app](https://github.com/Codesmith28/gruvbox-herdr-app) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [cszhe/herdr-terminal-id-header](https://github.com/cszhe/herdr-terminal-id-header) | App | (README 未提) | Y | Y | - |
| [cunderw/herdr-mods](https://github.com/cunderw/herdr-mods) | App | (README 未提) | Y | Y | Y |
| [cybertron288/herdr-mods](https://github.com/cybertron288/herdr-mods) | App | install.sh, agent/recipe | Y | Y | - |
| [dantech99/herdr-linear](https://github.com/dantech99/herdr-linear) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [DeevsDeevs/deevs-herdr-kit](https://github.com/DeevsDeevs/deevs-herdr-kit) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [dev-gvs/herdr-claude-usage](https://github.com/dev-gvs/herdr-claude-usage) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [dmazlum/herdr-arena](https://github.com/dmazlum/herdr-arena) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [dmazlum/herdr-doubletap](https://github.com/dmazlum/herdr-doubletap) | App | install.sh, agent/recipe | Y | Y | - |
| [dmazlum/herdr-fleece](https://github.com/dmazlum/herdr-fleece) | App + TUI | README: 手動複製, agent/recipe, herdr plugin install(TUI) | Y | Y | Y |
| [dmazlum/herdr-revive](https://github.com/dmazlum/herdr-revive) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [dmazlum/herdr-walkthrough](https://github.com/dmazlum/herdr-walkthrough) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [DnzzL/herdr-automations](https://github.com/DnzzL/herdr-automations) | App + TUI | install.sh, README: ln -s, agent/recipe, herdr plugin install(TUI) | Y | Y | - |
| [EkeMinusYou/herdr-launcher](https://github.com/EkeMinusYou/herdr-launcher) | App + TUI | agent/recipe, herdr plugin install(TUI) | Y | Y | Y |
| [emoss08/herdr-wsl](https://github.com/emoss08/herdr-wsl) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [ergunozyurt/herdr-super-agent](https://github.com/ergunozyurt/herdr-super-agent) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [ernestjsf/herdr-devices](https://github.com/ernestjsf/herdr-devices) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [fatwang2/Pulse](https://github.com/fatwang2/Pulse) | App | install.sh, Makefile, agent/recipe | Y | Y | - |
| [funny-it-worked-last-time-gsv/herdr-screenshot-mode](https://github.com/funny-it-worked-last-time-gsv/herdr-screenshot-mode) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [funny-it-worked-last-time-gsv/herdr-sit-and-watch](https://github.com/funny-it-worked-last-time-gsv/herdr-sit-and-watch) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [GaganSD/coding-agent-toolkit](https://github.com/GaganSD/coding-agent-toolkit) | App | (README 未提) | Y | Y | - |
| [greenflagged/herdr-forge](https://github.com/greenflagged/herdr-forge) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [greenflagged/herdr-greenflagged](https://github.com/greenflagged/herdr-greenflagged) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [herdrdev/herdr-layout-examples](https://github.com/herdrdev/herdr-layout-examples) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [Izzy2024/More-Agent-Mod](https://github.com/Izzy2024/More-Agent-Mod) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [jakub-tucek/herdr-annotator](https://github.com/jakub-tucek/herdr-annotator) | App | README: 手動複製 | Y | Y | - |
| [jankeesvw/herdr-focus-to-hover](https://github.com/jankeesvw/herdr-focus-to-hover) | App | README: ln -s, README: 手動複製 | - | - | - |
| [jankeesvw/herdr-issues](https://github.com/jankeesvw/herdr-issues) | App | README: ln -s, README: 手動複製 | Y | Y | - |
| [jankeesvw/herdr-space-folders](https://github.com/jankeesvw/herdr-space-folders) | App | README: ln -s, README: 手動複製 | Y | Y | Y |
| [jenthous/herdr-app-linear](https://github.com/jenthous/herdr-app-linear) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [JinJieBeWater/herdr-t3-focus](https://github.com/JinJieBeWater/herdr-t3-focus) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [jjongkwann/herdr-files-plus](https://github.com/jjongkwann/herdr-files-plus) | App | README: 手動複製 | Y | Y | - |
| [johnny4young/herdr-relevo](https://github.com/johnny4young/herdr-relevo) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [jspoynor/herdr-copy-on-select](https://github.com/jspoynor/herdr-copy-on-select) | App | (README 未提) | Y | Y | - |
| [juliorr/herdr-cursor-status](https://github.com/juliorr/herdr-cursor-status) | App | README: 手動複製 | Y | Y | - |
| [juliorr/herdr-space-avatars](https://github.com/juliorr/herdr-space-avatars) | App | README: 手動複製 | Y | Y | - |
| [kccarlos/herdr-sheepdog](https://github.com/kccarlos/herdr-sheepdog) | App + TUI | install.sh, Makefile, agent/recipe, herdr plugin install(TUI) | Y | Y | - |
| [kissmikijr/herdr-markdown-reader](https://github.com/kissmikijr/herdr-markdown-reader) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [Lakris2407/herdr-quota](https://github.com/Lakris2407/herdr-quota) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [linziyanleo/herdr-mods](https://github.com/linziyanleo/herdr-mods) | App | install.sh | Y | Y | - |
| [longwave/herdr-auto-tabs](https://github.com/longwave/herdr-auto-tabs) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [martinkozle/herdr-corral](https://github.com/martinkozle/herdr-corral) | App | agent/recipe | Y | Y | Y |
| [matthewjfberry/herdr-claude-resume](https://github.com/matthewjfberry/herdr-claude-resume) | App | README: 手動複製, agent/recipe | - | - | - |
| [mirkobozzetto/herdr-app-config](https://github.com/mirkobozzetto/herdr-app-config) | App | install.sh, agent/recipe | Y | Y | Y |
| [mjanjic01/herdr-kelpie](https://github.com/mjanjic01/herdr-kelpie) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [monorkin/herdr-app-hoverfocus](https://github.com/monorkin/herdr-app-hoverfocus) | App | README: 手動複製 | Y | Y | - |
| [mrolafsson/herdr-github](https://github.com/mrolafsson/herdr-github) | App + TUI | install.sh, agent/recipe, herdr plugin install(TUI) | Y | Y | Y |
| [mrolafsson/herdr-linear](https://github.com/mrolafsson/herdr-linear) | App + TUI | install.sh, agent/recipe, herdr plugin install(TUI) | Y | Y | Y |
| [mrolafsson/herdr-recap](https://github.com/mrolafsson/herdr-recap) | App + TUI | install.sh, agent/recipe, herdr plugin install(TUI) | Y | Y | Y |
| [mrolafsson/herdr-vitals](https://github.com/mrolafsson/herdr-vitals) | App + TUI | install.sh, agent/recipe, herdr plugin install(TUI) | Y | Y | Y |
| [mustafaTokmak/herdr-reopen-tab](https://github.com/mustafaTokmak/herdr-reopen-tab) | App | install.sh, agent/recipe | Y | Y | Y |
| [nakamotosai/herdr-agent-panels](https://github.com/nakamotosai/herdr-agent-panels) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [NazzarenoGiannelli/herdr-roundup](https://github.com/NazzarenoGiannelli/herdr-roundup) | App | README: 手動複製 | Y | Y | - |
| [NikosTsompanides/herdr-pr-reviews](https://github.com/NikosTsompanides/herdr-pr-reviews) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [obrunogonzaga/herdr-mods](https://github.com/obrunogonzaga/herdr-mods) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [ohneda/herdr-markdown-browser](https://github.com/ohneda/herdr-markdown-browser) | App | README: 手動複製 | Y | Y | Y |
| [ohneda/herdr-sync-panes](https://github.com/ohneda/herdr-sync-panes) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [ozcberkay/herdr-coban](https://github.com/ozcberkay/herdr-coban) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [pilmokim/herdr-pixel-spaces](https://github.com/pilmokim/herdr-pixel-spaces) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [rabeeh-ta/herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [rdurica/herdr-agents-first](https://github.com/rdurica/herdr-agents-first) | App | install.sh, agent/recipe | Y | Y | - |
| [rgonek/Juhas](https://github.com/rgonek/Juhas) | App | install.sh, agent/recipe | Y | Y | - |
| [riyhs/herdr-tool-rail](https://github.com/riyhs/herdr-tool-rail) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [suppa-duppa-labs/herdr-space-groups](https://github.com/suppa-duppa-labs/herdr-space-groups) | App | agent/recipe | Y | Y | - |
| [TaterDoge/herdr-mods](https://github.com/TaterDoge/herdr-mods) | App | README: 手動複製, agent/recipe | Y | Y | Y |
| [teknologist/herdr-space-ports](https://github.com/teknologist/herdr-space-ports) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [thebends2k/herdr-ssh-hosts](https://github.com/thebends2k/herdr-ssh-hosts) | App | README: 手動複製 | Y | Y | - |
| [thuanlm215/herdr-agent-resume](https://github.com/thuanlm215/herdr-agent-resume) | App | (README 未提) | Y | Y | Y |
| [thuanlm215/herdr-float-space](https://github.com/thuanlm215/herdr-float-space) | App | README: 手動複製 | Y | Y | Y |
| [vinaytiparadi/herdr-mods](https://github.com/vinaytiparadi/herdr-mods) | App | install.sh, agent/recipe | Y | Y | Y |
| [vytasgavelis/herdr-reviewer](https://github.com/vytasgavelis/herdr-reviewer) | App | install.sh, agent/recipe | Y | Y | - |
| [wapenshaw/herdr-customize](https://github.com/wapenshaw/herdr-customize) | App + TUI | herdr plugin install(TUI) | Y | Y | Y |
| [wkruan/herdr-app-perforce](https://github.com/wkruan/herdr-app-perforce) | App | README: 手動複製, agent/recipe | Y | Y | - |
| [yama-lei/herdr-editor-layout](https://github.com/yama-lei/herdr-editor-layout) | App | install.sh | Y | Y | Y |
| [yycholla/herdr-easel-mod](https://github.com/yycholla/herdr-easel-mod) | App | README: 手動複製, agent/recipe | Y | Y | - |

## 對 herdr-recall 的意涵

1. **`install.sh` 沒問題，但不是官方路徑。** 官方是 agent 讀 repo 後複製；`install.sh` 屬社群常見的備援（20 / 100）。保留它不違反任何慣例；`mustafaTokmak/herdr-reopen-tab`、`mirkobozzetto/herdr-app-config` 都是「agent 優先、腳本備援」的寫法，README 可以仿效。
2. **「複製而非 symlink」與社群共識一致。** 至少 `dmazlum/*`、`jjongkwann/herdr-files-plus`、`jankeesvw/*` 等 README 獨立記載 symlink 會導致不重載或 icon／圖片不載入（見上）。官方文件本身沒有寫這點（未驗證官方立場）。herdr-recall 的 `install.sh` 註解「Herdr loads a mod's icons only from inside its home folder」與這些說法相符。官方的 agent 流程本來就是複製資料夾，所以 recipe 路線不會有 icon 問題。
3. **想被 herdr.dev/mods 收錄，目前缺三樣。** 本 repo 的 GitHub topics 是空的（`gh repo view --json repositoryTopics`），根目錄沒有 `RECIPE.md`、`preview.png`（`ls`：只有 `assets/icon.svg`、`docs/*.svg`）。要收錄需：加 topic `herdr-mod`、寫 `RECIPE.md`（六段結構見上）、放 `preview.png`。目錄結構 `mods/recall/` 與 `keys.json` 已符合格式。收錄條件是否還有其他限制（例如 `preview.png` 尺寸）：未驗證。
4. **`keys.json` 合併是預期行為。** 官方要求 agent 合併、遇到衝突先問（`AGENTS.md:432-433`）。herdr-recall 目前讓使用者手動綁鍵，與 `atuinsh/herdr-atuin-threads` 的「merge `keys.json` into yours」相同；若想自動化，`mustafaTokmak/herdr-reopen-tab` 的「寫入但絕不覆蓋已用 key」是可參考做法，不過需自行處理 JSON 合併（本調查未讀其實作）。
5. **`rsync --delete` 的風險。** `johnny4young/herdr-relevo` 明確警告 `--delete` 會刪掉使用者自己的 icon。herdr-recall 的 `mods/recall/` 是自己擁有的資料夾，且已排除 app 產生的型別檔，風險較小，但若 app 還會寫入其他檔（例如 mod 自己的狀態）仍值得確認。AGENTS.md:86 說 `data/` 等狀態檔在 home 層而非 mod 資料夾內，但 mod 資料夾內 Herdr 會寫哪些檔，本調查只確認 `gpui-kit.d.ts`、`herdr.d.ts`、`jsconfig.json`（見 install.sh 註解，未獨立驗證）。
6. **安全揭露。** 官方要求 agent 在安裝前告知 mod 是否連網、執行程式、讀資料夾外的檔案。若 recall 會做其中任何一項，`RECIPE.md` 的 "Watch out" 與 README 應明寫。

## 未能驗證

- herdr.dev 其他頁面（`/guide/`、`/docs/` 的 mod 相關章節）沒有逐頁抓取，只抓了 `/mods` 與 `/docs/plugins/`；WebFetch 的內容是經模型摘要的，不是原文。
- 100 個 repo 恰為搜尋上限，`herdr-mod` topic 下可能還有更多；`herdr-layout`（60 個）與 `herdr-plugin`（約 70 個）topic 只列名單、未做同等深度掃描。
- 「Herdr」欄與「安裝方式」欄為依檔案與 README 關鍵字的啟發式推論，沒有逐 repo 人工閱讀。
- 官方對 symlink 與 icon 的行為沒有文件，僅有社群 README 的說法，我沒有實際測試。
- herdr.dev 收錄 repo 的實際條件（是否強制要求 `preview.png`／`RECIPE.md`）未驗證，僅依官方文字推論。
- `AGENTS.md` 中 keys 與 icon 兩段的行號為約略值（標 `~`）。
