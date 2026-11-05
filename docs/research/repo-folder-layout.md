# herdr-recall 的資料夾結構：官方、社群與 pstack 的對照

調查日期：2026-11-05。本文建立在 [herdr-mod-distribution.md](herdr-mod-distribution.md) 之上：那份已確認 Herdr app 的分享格式（`mods/<name>/` 加 `RECIPE.md`、`preview.png`、選用 `keys.json`）、agent 安裝流程與 symlink 的社群說法，這裡不重複，只補「資料夾該怎麼擺」。

## 簡短結論

目前的結構不需要改。唯一的硬性規定來自 Herdr：mod 資料夾直接含 `main.js`，資料夾名就是 mod id，而且 mod 只能 import 自己資料夾內的檔案（路徑會先 canonicalize，所以 symlink 出去也不行）。其餘都是建議或慣例，本 repo 都符合：分享格式的檔案放根目錄，mod 程式碼在 `mods/recall/`，測試在 mod 之外的 `tests/`（與 Herdr 自己測 shipped mod 的方式相同，也是社群多數做法，而且不會被官方 agent 流程複製進使用者的 home），`site/` 透過 GitHub Actions 發佈（`site/` 這種資料夾名只有 Actions 能用），`site/lib` 等 symlink 方向是「站點指向 mod」，正好是 Herdr import 規則允許的唯一方向。`backnotprop/pstack` 是另一種東西（Agent Skills／Cursor plugin 的 mirror），它的版面由它自己的宿主規格決定，沒有寫任何版面理由，可借鏡的只有「每個單元一個資料夾、宿主定義的頂層目錄」這個與 Herdr 相同的模式。唯一可選的清理是 `site/.nojekyll`：在現行部署下它沒有作用，但留著也無害。

## 本 repo 現況（已讀取驗證）

`git ls-files`（commit `c34bbc0`）與 `ls -la site`：

```
.github/FUNDING.yml, .github/workflows/{test,deploy-pages}.yml
AGENTS.md  GLOSSARY.md  LICENSE  README.md  README.zh-TW.md  RECIPE.md
install.sh  keys.json  preview.png  assets/icon.svg
docs/adr/  docs/agents/  docs/research/
mods/recall/{main.js, ui.js, mod.json, lib/*.js, icons/*.svg}
site/{index.html, app.js, world.js, styles.css, .nojekyll}
site/lib -> ../mods/recall/lib      site/icons -> ../mods/recall/icons
site/favicon.svg -> ../assets/icon.svg   site/preview.png -> ../preview.png
tests/*.test.mjs, tests/fixtures.mjs
```

- 沒有任何 `package.json`（整個 repo 都沒有），也沒有 build 步驟。`mods/recall/lib/*.js` 是 ES module，靠 Node 的 syntax detection 執行（`.github/workflows/test.yml:19-20` 註解）。
- CI 跑 `node --test 'tests/*.test.mjs'`，Node 26（`.github/workflows/test.yml:21-25`）。
- import 方向：`tests/*.mjs` → `../mods/recall/lib/*.js` 與 `../site/world.js`；`site/app.js`、`site/world.js` → `./lib/*.js`（經 symlink 到 mod）；`mods/recall/` 只 import `gpui-kit`、`gpui-base`、`herdr` 與自己的檔案（`grep import`）。沒有任何東西從 mod 往外 import。
- GitHub Pages 的 build type 是 `workflow`（`gh api repos/shihyuho/herdr-recall/pages`），即 Actions 部署。

## Herdr（第一方，唯一真正有約束力的來源）

版本：本機 `herdr-app 0.1.13`。原始碼讀的是 tag [`v0.1.13`](https://github.com/herdrdev/herdr-app/tree/v0.1.13)（`93b097f`）；本機 `~/.config/herdr-app/AGENTS.md` 與該 tag 的 `defaults/AGENTS.md` 逐字相同（`diff` 無輸出）。下文的 `AGENTS.md:行號` 指這份檔案。

### 規定（requires）

1. **mod 資料夾必須直接含 `main.js`，資料夾名即 id。** `src/mods.rs:356-386` 的 `scan_dir` 列出 `mods/` 下每個 entry，只保留 `e.path().join("main.js").is_file()` 者，id 取資料夾名，`.` 開頭的忽略；`mod.json` 讀不到就用預設值（`unwrap_or_default`），所以 `mod.json` 是選用的。文件同說法：`AGENTS.md:774-779`（`main.js the mod (required)`）。
2. **mod 只能 import 自己資料夾裡的檔案。** gpui-shell 的 `load_app` 註解：「Module resolution is scoped to that directory: an application can import its own files and the built-in modules, and nothing else」（`vendor/gpui-kit/crates/shell/src/engine/quickjs/mod.rs:2175-2180`）。實作上 `resolve_app_root` 先把 mod 根目錄 canonicalize（`vendor/gpui-kit/crates/shell/src/runtime.rs:128-148`），相對 import 解析後也 canonicalize，再檢查是否仍在根目錄下，否則丟出「module … resolves outside the application directory」（`quickjs/mod.rs:5404-5486`）。因為比對前已解開 symlink，**mod 內放一個指向 repo 其他地方的 symlink 也會被拒**（由程式碼推論，未實測）。
3. **安裝時被複製的單位是整個 mod 資料夾。** `AGENTS.md:430`：「Copy the layout file to `layouts/` and each mod folder to `mods/`. Leave the recipe and preview out.」也就是說 mod 資料夾內的一切都會進使用者的 home。

### 建議（recommends）

- 分享用的 repo「laid out like this home」：mod 只有 `mods/<name>/`，外加選用的 `keys.json`，旁邊有 `RECIPE.md` 與 `preview.png`（`AGENTS.md:416-423`）；多個 mod 時「one folder each」（`AGENTS.md:444-448`）。官方範例 [`herdrdev/herdr-layout-examples`](https://github.com/herdrdev/herdr-layout-examples/tree/0ec967640bf854ffb839e9af06c1e0c328bc9815) 每個作品一個頂層資料夾，內含 `RECIPE.md`、`preview.png`、`layouts/`、`mods/<name>/`，`tmux-prefix/` 另有 `keys.json`（`gh api …/git/trees`）。
- mod 內部：`*.js, *.svg  more modules ("./ui.js"), its own icons`（`AGENTS.md:778`）。文件只舉平鋪的例子，**沒有規定也沒有禁止子資料夾**。

### Herdr 自己的做法（first-party practice，非規定）

- shipped mod 大多平鋪（`agents/`、`pane/`、`tabs/` 等只有 `main.js`、`mod.json`、`*.svg`）；唯一例外 `defaults/mods/win98/` 有 `icons/`、`fonts/`、`img/`、`sounds/`、`art/` 子資料夾（v0.1.13 tree）。所以「資產放子資料夾」有第一方先例；「JS 模組放 `lib/` 子資料夾」沒有第一方先例，只有 Recall 自己 `herdr-app check` 通過這個實證（`RECIPE.md` 的 Done when）。
- shipped mod 的 JS 測試放在 mod 資料夾**之外**：`scripts/picker.test.ts` 等用 `bun:test`，以 `readFile(new URL("../defaults/mods/picker/main.js", import.meta.url))` 讀 mod 原始碼（`scripts/picker.test.ts:1-22`，v0.1.13 有 8 個 `scripts/*.test.ts`）；CI 以 `bun test scripts/docs.test.ts` 等執行（`.github/workflows/ci.yml:128-135`，讀於 HEAD `e77f112`）。
- 熱重載忽略 app 自己寫的檔案（`jsconfig.json`、`.d.ts`、隱藏檔、`node_modules`），其餘任何檔案存檔都會重載（`AGENTS.md:789-791`）。放在 mod 內的測試檔也算「任何檔案」。
- gpui-shell 支援 mod 根目錄的 `gpui-shell.json` 依賴 manifest（`vendor/gpui-kit/crates/shell/src/plugin.rs:62`、`quickjs/mod.rs:2189-2207`），但 `AGENTS.md` 完全沒提，視為未公開功能，與本 repo 無關。

## 其他大廠／官方來源

只挑與本 repo 形狀相符的：no-build 純 JS、Node 測試、靜態站、GitHub 上的開源 repo。

### Node.js（v26.9.0，CI 用的版本）

- **測試檔探索（規定預設值，可覆寫）。** `node --test` 不帶參數時跑符合 `**/*.test.{cjs,mjs,js}`、`**/*-test.*`、`**/*_test.*`、`**/test-*.*`、`**/test.*`、`**/test/**/*.{cjs,mjs,js}` 的檔案；也可傳 glob 取代（[`doc/api/test.md:720-756`](https://github.com/nodejs/node/blob/v26.9.0/doc/api/test.md#running-tests-from-the-command-line)）。Node **沒有建議**測試放哪個資料夾。`tests/*.test.mjs` 符合預設 pattern；`tests/fixtures.mjs` 不符合，所以即使不帶 glob 也不會被當成測試。反過來，若改名為 `test/`（單數），`**/test/**/*.mjs` 會把 `fixtures.mjs` 也當測試跑（由文件推論）。
- **module 型別（建議）。** 沒有 `package.json` 時，含 `import`/`export` 的 `.js` 屬「ambiguous」，Node 先試 CommonJS、失敗再以 ES module 執行；文件說這有效能成本，並說「package authors should always include the `"type"` field」（[`doc/api/packages.md:60-105`](https://github.com/nodejs/node/blob/v26.9.0/doc/api/packages.md)；syntax detection 自 v22.7.0 預設開啟，同檔 :108-119）。本 repo 不是 npm package，這條建議的對象不完全是它；影響只在測試的啟動時間。

### GitHub

- **Pages 發佈來源（規定）。** 從 branch 發佈時，來源資料夾只能是 `/`（root）或 `/docs`（[`data/reusables/pages/pages-about-branch-source.md`](https://github.com/github/docs/blob/58b7b56aa507ad1269b9f8e9e89a172f0976c7ce/data/reusables/pages/pages-about-branch-source.md)）；不想用 Jekyll 或不想要專用 branch 時，官方建議寫 Actions workflow（[`pages-about-publishing-source.md`](https://github.com/github/docs/blob/58b7b56aa507ad1269b9f8e9e89a172f0976c7ce/data/reusables/pages/pages-about-publishing-source.md)）。所以 `site/` 這個資料夾名**只有** Actions 部署能用；本 repo 正是如此。若改用 `/docs`，會和 `docs/adr`、`docs/agents`、`docs/research` 混在同一個發佈根目錄。
- **`.nojekyll`（規定的適用範圍）。** 只有「從 source branch 發佈」時 Pages 才跑 Jekyll，`.nojekyll` 要放在「publishing source 的根目錄」才會停用它（[`creating-a-github-pages-site.md:69`](https://github.com/github/docs/blob/58b7b56aa507ad1269b9f8e9e89a172f0976c7ce/content/pages/getting-started-with-github-pages/creating-a-github-pages-site.md)）。另外 `actions/upload-pages-artifact@v5`（`fc324d3`）打包時預設 `--exclude=.[^/]*`（`include-hidden-files` 預設 `"false"`），並用 `--dereference --hard-dereference`（[`action.yml:17-39`](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml)）。兩者合起來：`site/.nojekyll` 根本不會進 artifact，而 Actions 部署本來也不跑 Jekyll。後一個 flag 也確認了 `deploy-pages.yml:3-5` 註解所說「symlink 會被解開」。
- **特殊檔案位置（規定）。** `FUNDING.yml` 必須在 `.github/`；其他 community health 檔可放 root、`.github/` 或 `docs/`，優先序 `.github` > root > `docs`（[`creating-a-default-community-health-file.md:27-31, 93-96`](https://github.com/github/docs/blob/58b7b56aa507ad1269b9f8e9e89a172f0976c7ce/content/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file.md)）。README 同樣認 `.github`、root、`docs`（[`about-readmes.md:31-33`](https://github.com/github/docs/blob/58b7b56aa507ad1269b9f8e9e89a172f0976c7ce/content/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes.md)）。LICENSE 放 root 是常見做法（「Most people place their license text … in the root」，[`licensing-a-repository.md:27`](https://github.com/github/docs/blob/58b7b56aa507ad1269b9f8e9e89a172f0976c7ce/content/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository.md)）。本 repo 全部符合。

### 可比較的宿主平台

- **Chrome extensions：** 「Every extension must have a `manifest.json` file in its root directory」，其餘檔案的組織沒有規定（https://developer.chrome.com/docs/extensions/reference/manifest ，WebFetch，內容經模型摘要）。官方範例 repo [`GoogleChrome/chrome-extensions-samples`](https://github.com/GoogleChrome/chrome-extensions-samples/tree/b7d8bebb00bb11191126c6abbe471ec5f79c4feb) 在一個 repo 裡用 `functional-samples/`、`api-samples/` 放多個 extension，各自一個資料夾，root 放 `package.json`、lint 設定等 repo 工具。模式與「`mods/<name>/` 是宿主單元，repo 工具放外面」相同。
- **Obsidian plugins：** 對照組。`manifest.json` 「must be in two places, first the root path of your repository and also in the release」，README 也要在 root（[`obsidian-sample-plugin` README:35, 45](https://github.com/obsidianmd/obsidian-sample-plugin/tree/07ceb81d1fb3384af611ebf665a1ec42a7e5926d)）。它有 build（`src/main.ts` → `main.js`）。Herdr 沒有這種 root manifest 規定，而是用 `mods/<name>/`，所以 Obsidian 的 root 版面不適用。

## 社群（同形狀的 Herdr mod repo）

方法：`gh search repos --topic herdr-mod --limit 200`（剛好 200，達上限），逐一抓 `git/trees/HEAD?recursive=1`，以 regex 分類（腳本為啟發式，不是逐 repo 人工閱讀）。下表扣除本 repo，母數 199。

| 項目 | 數量 |
| --- | --- |
| `mods/<name>/main.js` 在 repo 根的 `mods/` 下 | 149 |
| `mods/` 在更深一層（類似 `herdr-layout-examples` 或 monorepo） | 46 |
| 一個 repo 多個 mod | 58 |
| mod 資料夾內有子資料夾 | 58（最常見 `icons/` 33、`lib/` 8） |
| 有測試檔 | 91 |
| 測試在 mod 資料夾之外 | 82（頂層 `tests/` 42、`test/` 30，其餘散在 `scripts/` 等） |
| 測試在 mod 資料夾之內 | 11 |
| root 有 `package.json` | 45 |
| 有 Pages workflow | 2（`runkids/figlens`、`runkids/skillshare`） |

結論（常見做法，非規定）：`mods/<name>/` 在 root、`icons/` 子資料夾、測試放 mod 外的 `tests/` 或 `test/`，都是多數做法。`tests/` 與 `test/` 大約各半，沒有共識。帶 Pages 站點的 mod repo 極少，社群沒有可依循的慣例。

同形狀範例（純 JS mod + `lib/` + Node 測試）：

- [`dmazlum/herdr-arena`](https://github.com/dmazlum/herdr-arena/tree/51b43b337bd1e65ebdb9690e6773d93cf2ef4ae1)：`mods/arena/lib/*.js`，測試在 root `test/*.test.js`，root `package.json` 只有 `"type": "module"` 與 `"test": "node --test test/*.test.js"`（`private: true`）。[`dmazlum/herdr-walkthrough`](https://github.com/dmazlum/herdr-walkthrough/tree/5c75c3c4ff2933b324c1e3a2a308d0b5a4feb8cb) 同型。
- [`ergunozyurt/herdr-super-agent`](https://github.com/ergunozyurt/herdr-super-agent/tree/85ce7316b9957fc5795995fe392b4cf31087e591)：`mods/<name>/lib/`，root `test/*.test.mjs`。
- 測試放在 mod 內：[`nozikov/herdr-usage-limits`](https://github.com/nozikov/herdr-usage-limits/tree/048dbe911ee957f42d465d950a5ce04d61fed904)（`mods/usage-limits/test/` 含 fixtures 與假 CLI）、[`johnny4young/herdr-relevo`](https://github.com/johnny4young/herdr-relevo/tree/5167f480e89fb8e64dbf3dd5d76e12501801d475)（`mods/relevo-files/test/`）、[`kccarlos/herdr-sheepdog`](https://github.com/kccarlos/herdr-sheepdog/tree/797b50a4e95c5632dac41d2abfca1d54604a9f97)（`mods/sheepdog/model/*.test.mjs` 與程式碼並排）。依 Herdr 的規定 3，這些測試會隨官方流程被複製進使用者的 `~/.config/herdr-app/mods/`（推論，未實測各 repo 的安裝結果）。

## backnotprop/pstack

讀的是本機 ghq mirror（`/Users/matt/code/github.com/backnotprop/pstack`），commit `25abb38`；`origin/main` 為 `6c75f4e`，差異只有 `MIRROR.md` 與新增 `SYNC-LOG.md`（`git diff --stat`），不影響版面。

### 它是什麼

- 一個 mirror：「This repo mirrors `cursor/plugins/pstack` and adds its own edits」，以 `upstream` branch 存 Cursor 原檔、`main` 疊上 mirror 的修改（`MIRROR.md:3-10`）。
- 內容是 Agent Skills 與 agent prompt，不是程式外掛：「pstack is a folder of plain Agent Skills (`skills/<name>/SKILL.md`)」，用 `npx skills add backnotprop/pstack` 安裝（`README.md:34-38`）。作者 Lauren Tan（`plugin.json`）。

### 版面

```
plugin.json                    agent-plugins.org schema 的 manifest
.cursor-plugin/plugin.json     "skills": "./skills/", "agents": "./agents/", "logo": "assets/logo.png"
skills/<name>/SKILL.md         + references/、scripts/、playbooks/（各 skill 自選）
agents/*.md
automations/benny/             README、skills/、templates/
docs/guide/、docs/harness/
assets/logo.png                上游的
mirror-assets/*.svg            mirror 自己的 README 圖
MIRROR.md  README.md  LICENSE
```

檔案數：`skills/` 536、`docs/` 18、`automations/` 12，其餘個位數（`git ls-files | awk`）。

- 頂層的 `skills/`、`agents/` 是宿主規格決定的：`.cursor-plugin/plugin.json` 明寫 `"skills": "./skills/"`、`"agents": "./agents/"`。skill 內部的 `scripts/`、`references/`、`assets/` 來自 Agent Skills 規格：一個 skill 只要求 `SKILL.md`，這三個是「recommendations for organizing common types of content」，也允許任何其他檔案（https://agentskills.io/specification ，WebFetch，內容經模型摘要）。`playbooks/` 是 pstack 自己加的。
- 程式碼與測試在 skill 內：`skills/poteto-mode/scripts/` 有自己的 `package.json`、`bun.lock`，測試與原始碼並排（`watch-pr/cli.ts` 與 `cli.test.ts`）；`skills/statechart/scripts/test/` 則是獨立測試資料夾加 corpus。兩種擺法並存，沒有統一。

### 是否說明了理由

沒有。README、`MIRROR.md`、`docs/guide/*`、`docs/harness/claude-code.md`、`skills/poteto-mode/playbooks/authoring-a-skill.md` 都沒有談 repo 版面為何如此（`grep -i "layout|directory|folder structure|…"` 只找到連結，沒有理由）。唯一隱含的設計是 `mirror-assets/` 與上游的 `assets/` 分開，配合 `MIRROR.md:20` 的 `rsync -a --delete … ./` 同步：mirror 自有檔放在上游不會碰的路徑。這是從同步流程推論的動機，文件沒有明說。

### 對 herdr-recall 的參考價值

形狀不同（純 Markdown skill 集合、無 Herdr 宿主），能借鏡的只有與 Herdr 相同的模式：宿主定義頂層目錄、每個單元一個資料夾、單元內自由組織。它把測試放進會被安裝的單元內，在 Agent Skills 底下影響不大；但在 Herdr 會被複製進使用者 home，所以不適合照搬。

## 比較：本 repo 對照各來源

| 項目 | 本 repo | 依據 | 判定 |
| --- | --- | --- | --- |
| `mods/recall/main.js` 直接在 mod 根 | 是 | Herdr 規定 1 | 符合規定 |
| mod 不往外 import | 是（只 import 內建模組與自己的檔） | Herdr 規定 2 | 符合規定 |
| `RECIPE.md`、`preview.png`、`keys.json` 在 `mods/` 旁 | 是（root） | Herdr 建議（`AGENTS.md:416-448`） | 符合建議 |
| mod 內 `icons/` 子資料夾 | 是 | 第一方先例（win98）、社群最常見 | 符合慣例 |
| mod 內 `lib/` 放 JS 模組 | 是 | 無第一方先例；社群 8 個 repo；resolver 允許（規定 2 只限「不出根目錄」） | 可行，屬少數但有前例 |
| 測試在 mod 外 `tests/` | 是 | Herdr 自己測 shipped mod 的方式；社群 82 vs 11；不會被規定 3 複製出去 | 符合第一方做法與多數慣例 |
| `tests/` vs `test/` | `tests/` | Node 無建議；社群各半 | 皆可；`tests/` 讓 `fixtures.mjs` 不被預設 pattern 誤抓 |
| 無 `package.json` | 是 | Node 對 package author 建議寫 `"type"`；社群 45/199 有 | 偏離一條非針對本 repo 的建議，影響只在測試啟動效能 |
| `site/` + Actions 部署 | 是 | GitHub：branch 只能 `/` 或 `/docs`，其他資料夾需 Actions | 符合規定 |
| `site/*` symlink 指向 mod | 是 | Herdr 規定 2 只允許這個方向；upload-pages-artifact 會解開 symlink | 正確方向 |
| `site/.nojekyll` | 有 | 只對 branch 發佈的根目錄有效；artifact 預設排除隱藏檔 | 無作用，也無害 |
| `.github/FUNDING.yml`、root `LICENSE`、README | 是 | GitHub 規定／常見做法 | 符合 |
| `docs/adr`、`docs/agents`、`docs/research` | 是 | 無外部規定（`AGENTS.md` 的專案約定） | 不受外部約束 |

## 建議變更

**必要變更：無。** 沒有任何規定被違反；所有建議或第一方做法也都已符合，或偏離的理由成立。

可選項目（都不是必要，列出成本供取捨）：

1. **刪除 `site/.nojekyll`。** 依據：GitHub Pages 文件（`.nojekyll` 只作用在 branch 發佈的根目錄）與 `upload-pages-artifact` 預設排除隱藏檔。成本：一個檔案；不影響 install.sh、symlink、測試 workflow、README 連結。好處只有少一個沒作用的檔案；保留也完全無害。
2. **（不建議）加 root `package.json`，內容只放 `{"private": true, "type": "module"}`。** 依據：Node `packages.md` 對 package author 的建議；社群如 `dmazlum/herdr-arena` 這樣做。效果：`lib/*.js` 在 Node 下不再是 ambiguous，CI 不必依賴 22.7 以後的 syntax detection（可移除 `test.yml:19-20` 的註解理由）。成本：多一個可能被誤解為「需要 npm install」的檔案（本 repo 目前沒有任何相依或 build）；`install.sh` 只複製 `mods/recall/`，不受影響；Herdr 讀的是 `gpui-shell.json` 而不是 `package.json`，所以 mod 也不受影響。收益很小，因為 CI 已釘 Node 26。

明確**不**建議的變更（以免日後被提出）：

- 把 `lib/` 攤平到 mod 根：沒有任何來源要求；會改動 `site/lib` symlink、全部 `tests/*.mjs` 的 import 路徑、`RECIPE.md` 的 Built from。
- 把測試搬進 `mods/recall/`：違反 Herdr 自己的做法；官方 agent 流程會把測試複製進使用者 home（規定 3），存檔也會觸發重載。
- 把 `site/` 改名為 `docs/` 以改用 branch 發佈：會和 `docs/adr` 等混在發佈根目錄，而且 branch 發佈不會解開 symlink 的行為未驗證，可能破壞 `site/lib`。
- 把共用程式碼抽到 repo 層（例如 `shared/`）再讓 mod 用 symlink 引用：Herdr 會在 canonicalize 後拒絕（規定 2）。

## 未能驗證

- Herdr 對 mod 內 `lib/` 這類 JS 子資料夾沒有文件明說支援；我只依 resolver 程式碼與 Recall 的 `herdr-app check` 推定可用，這次沒有重新執行 check。
- 「mod 內 symlink 指向資料夾外會被拒」是讀 `quickjs/mod.rs` 的 canonicalize 加 `starts_with` 邏輯推論，未實測。
- `ci.yml` 的 bun 測試步驟讀的是 herdr-app HEAD `e77f112`，不是 v0.1.13（`scripts/*.test.ts` 本身在 v0.1.13 存在已確認）。
- Chrome manifest 與 Agent Skills 規格兩頁是 WebFetch 取得，內容經模型摘要，不是原始 HTML；我沒有找到這兩份文件的原始碼 repo 來逐字核對。
- 社群統計是 200 筆搜尋上限內的 regex 分類（測試檔判斷：`*.test.*`、`*.spec.*`、`test/`、`tests/`），可能有誤判；實際 `herdr-mod` repo 數可能更多。
- 測試放在 mod 內的 repo，實際安裝後是否真把測試帶進使用者 home，未逐一驗證（依官方「copy each mod folder」推論）。
- pstack 的上游 `cursor/plugins` 沒有讀；Cursor plugin 規格（`.cursor-plugin/plugin.json` 欄位意義）與 agent-plugins.org schema 只從 manifest 本身推知，沒有讀規格原文。
- 找過但沒找到：Herdr 對「repo 內測試／站點放哪」的任何說法；pstack 對版面的任何理由；Node 對測試資料夾名稱的任何建議。
