# Recall

Recall is a switcher for the Herdr app: it lists where you have been in Herdr, most recent first, and takes you back. Typing narrows that list by fuzzy match: rows where each typed word appears unbroken come first and the rest follow, both still most recent first.

## Language

**Category**:
One of the lists the switcher offers on its left, such as Spaces, Tabs, Panes or Agents; you switch between them, and only one shows at a time.
_Avoid_: tab (a Herdr tab is something else), section, filter

**All**:
The category that lists every space, tab, pane and agent together, so one search covers them all. Its title reads "Find Anywhere".
_Avoid_: Others

**Clues**:
The category that finds panes by their clues rather than by their names.
_Avoid_: Others, Find, All (its old meaning)

**Clue**:
A fact about a pane that leads to it: a command it runs, the host it is ssh'd into, a file it has open, text it printed, a port it listens on or a process it started.
_Avoid_: source, other, match

**Location**:
Where something sits: a pane or agent in its space and tab, a tab in its space, a space on its machine ("This computer" for this one).
_Avoid_: place (Herdr's word for a space), where

**Pane name**:
What Recall calls a pane, the same in every category, since Herdr names none: its agent's title, else the title its program gave it, else its program ("zsh").
_Avoid_: pane label, pane title
