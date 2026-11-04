# "All" means every category; clue search is "Clues"

The category named All used to search panes by their clues (what they run, ssh hosts, files, printed text, ports, processes), a name taken from herdr-recent-navigator's "Others" tab. People read "All" as every category at once, the way IntelliJ's Search Everywhere uses it, so All now lists every space, tab, pane and agent together, and clue search moved to its own category, Clues. The id `all` (in `recall.open-all` and the categories list of `recall.json`) changed meaning with the name rather than staying on clue search, and `others` now opens Clues, the list it always meant in herdr-recent-navigator: existing bindings to `all` open the new All, which we accepted while the mod had few users.

## Considered Options

- Keep the id and the list, renaming only the label (to Find): kept every config working, but "All" was what people had been led to expect, and a Find beside an All that also searches read as two names for one thing.
- Fold clues into All, after the spaces, tabs, panes and agents: one list fewer, but the choice was to keep All to places and give clues a category of their own.
