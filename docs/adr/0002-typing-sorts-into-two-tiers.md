# Typing sorts matches into two tiers, each most recent first

Recency and fuzzy search are both at Recall's core, so typing has to keep the recent order and still put close matches above loose ones. Rows where every typed term appears unbroken in some field form the upper tier and the other matches the lower, and each tier keeps the order the list had with nothing typed. fzf and herdr-bar sort by score instead; we chose tiers because a score order moves rows on nearly every keystroke, over differences too small to see, which surprised us when trying it in the prototype.

## Considered Options

- Score first, recency on ties (fzf's default, herdr-bar): the closest match is always on top, but rows trade places as you type.
- Filter only, keeping the recent order: the steadiest, but fuzzy matching is loose, so a recent row that matches by scattered letters stays above an older one that matches exactly.
- fzf's history scheme (its CTRL-R): score first with weaker bonuses, so more rows tie and recency decides them. Steadier than a plain score order, but still one.
