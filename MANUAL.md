# Sephral’s First Table: Manual

First Table gives every new player a friendly first session. A small card in the corner of the screen walks them through Foundry in seven chapters, one step at a time, and goes on only when the player has really done what the step asks for. The first chapter starts by itself at the player's first login, the others wait behind the question mark in the controls on the left. The GM does nothing. Nothing is changed in actors, scenes, journals or the chat. The module only remembers how far each player got.

## The guide for players

At the first login a new player sees a small card with three answers:

* **Show me around** starts the first chapter, *Your first steps*.
* **Not now** closes the card. The player is asked once more at a later login, then never again by itself.
* **I know Foundry** closes the card for good.

### The chapters

| Chapter | What it teaches |
| --- | --- |
| Your first steps | The basics: sheet, roll, moving, target, ping, ruler, chat, whisper, journal |
| The sidebar | Every tab of the right sidebar a player has, the roll modes, the volume and the settings |
| The scene controls | The toolbar on the left: tokens, select, target, ruler, shapes, notes and the help button |
| Your character sheet | The tabs of the sheet and what is on them, in the words of your game system |
| Chat and dice | Rolling by typing, rolls inside a message, looking at the dice, private rolls, emotes |
| In a fight | The combat tracker, initiative, whose turn it is, ending a turn, targets, the token menu |
| Useful extras | The macro bar, making a shortcut, the players list, pause, highlighting, pings and the GM |

Each step has a title, one or two sentences of explanation, what to do, and a ring that shows where to look. The ring is only a hint: it does not block clicks. A step goes on when the player really does the action. Steps that are only worth reading, like the pause banner, have a **Seen it** button. **Skip** is on every step.

The module only offers steps the player can use. A sidebar tab the player does not see (Scenes is only for players who may switch scenes), a control the GM hid, a game system a step is not meant for, or a part of the interface another module removed: the step is left out, and the chapter goes on with the next one.

### Your first steps

| Step | What the player does | How the module notices | Where the ring is |
| --- | --- | --- | --- |
| This is your character | Opens the character sheet, by double click on the token, the key C or the Actors tab | A window with an actor the player owns opens | The token |
| Roll the dice | Rolls from the sheet | The player makes a roll that lands in the chat | None, Show me opens the sheet |
| Move with the keys | Moves the selected token with W, A, S, D (Foundry 13 also the arrow keys) | The player's token moves while a movement key was just pressed | The token |
| Move by dragging | Drags the token to another square | The token moves after the pointer was used on the map | The token |
| Pick a target | Hovers over another token and presses T | The player targets a token | The other token |
| Ping the map | Presses and holds the mouse button on the map | A ping appears while the pointer is held on the map | None |
| Measure a distance | Picks the ruler and drags across the map | The player's ruler shows a distance | The ruler tool |
| Say something in the chat | Writes a line, best as a whisper to themselves | A typed message of the player | The chat box |
| Whisper to the GM | Types /w gm and a message | A whisper of the player to a GM | The chat box |
| Journals and handouts | Opens the Journal tab and an entry | The Journal tab or a journal opens | The Journal tab |

The roll step names what to click in the game system of your world: D&D 5e, Pathfinder 2e, SWADE and Crucible have their own text, every other system gets a general one. The step goes on after any roll the player makes. The two steps about tokens wait when the viewed scene has no token of the player, or no other token to target. The card then says why and the player can skip the step or wait.

### The sidebar

The player opens each tab, the ring sits on the tab button. A click on the tab that is already open counts too.

| Step | What the player does | How the module notices |
| --- | --- | --- |
| The chat | Clicks the chat tab | A click on the tab |
| Who sees your roll? | Clicks one of the buttons next to the chat box (public, private to the GM, blind, self, in Foundry 14 also in character) | A click on a button of the roll mode selector. The ring marks the selector (the chat tab while it is closed) |
| The combat tab, Scenes, Placeables (Foundry 14), Actors, Items, Journal, Rollable Tables, Card stacks, Macros, Playlists, Compendiums, Settings | Opens the tab | A click on the tab button, or the sidebar changes its tab |
| Your own volume | Moves a volume slider of the Playlists tab | An input on a range slider in the Playlists tab |
| Game settings | Opens the game settings window (volumes, language, audio and video options) | The settings window opens |
| The key overview | Opens the controls window (Configure Controls in Foundry 13, Controls Configuration in Foundry 14) | The controls window opens |

### The scene controls

| Step | What the player does | How the module notices |
| --- | --- | --- |
| Token controls | Clicks the person at the top of the left bar | A click on the layer button |
| The select tool, the target tool, the ruler | Clicks the tool | A click on the tool button |
| The question mark | Clicks the help button of this module | A click on the tool. The step keeps its card, the help button does not replace it with the menu |
| Measure shapes | Clicks the shapes button (called templates in Foundry 13, regions in Foundry 14) | A click on the layer button |
| Map notes | Clicks the notes button | A click on the layer button |

### Your character sheet

This chapter needs the sheet open. The first step opens it, the following steps wait for it and Show me opens it again if the player closed it.

| Step | What the player does | How the module notices | Systems |
| --- | --- | --- | --- |
| Open your sheet | Double click on the token or the key C | A sheet of an owned actor opens | all |
| Abilities and saves | Clicks the name of an ability and confirms the roll | A roll link on the sheet was clicked, and a roll message follows | D&D 5e |
| Skills | Clicks the name of a skill and confirms the roll | The same, for a skill | D&D 5e |
| Resting | Clicks the short rest button and cancels the window | A click on the rest button of the sheet | D&D 5e |
| The tabs of the sheet | Clicks another tab | A click on a tab of the player's sheet | all |
| Inventory, spells and powers, features and talents | Opens the tab | A click on a tab with a fitting name (inventory, items, gear, equipment, spells, spellcasting, powers, grimoire, magic, features, feats, edges, talents, traits) | all, the instruction uses the words of D&D 5e, Pathfinder 2e, SWADE and Crucible |
| Look at an item | Right click on an item and View or Edit | A window with an item of the player's actor opens | all |

A step for a tab that the sheet does not have (a fighter without spells on some systems) is skipped by itself. The sheet tabs of Pathfinder 2e, SWADE and Crucible are matched by their usual names and were not tested live.

### Chat and dice

| Step | What the player does | How the module notices |
| --- | --- | --- |
| Roll by typing | Types /r 1d20 | A roll message, and the text the player sent a moment before begins with a roll command |
| Dice inside a message | Types a sentence with [[/r 1d20]] in it | A message of the player whose text has a roll in double square brackets |
| Look at the dice | Clicks the total of a roll in the chat | A click on a roll card in the chat. The step waits until a roll is in the chat |
| Private rolls | Picks a private mode and rolls | A roll message with recipients (GM roll, blind roll or self roll) |
| Emotes | Types /em shrugs | A message with the emote style |

### In a fight

The fight steps need a fight. Without one the card says that the step waits for the next fight, and goes on when the GM creates one. The steps are made for the first fight, but the player can replay the chapter any time.

| Step | What the player does | How the module notices | Waits for |
| --- | --- | --- | --- |
| The combat tracker | Opens the Combat tab | The tab opens | A fight on this scene |
| Roll initiative | Clicks the die next to their name and confirms | The player's own combatant gets an initiative from this player | The player's character in the fight |
| Whose turn is it? | Looks for the highlighted entry. **Seen it** is there too | The turn changes to the player's combatant | A fight |
| End your turn | Clicks the End Turn button | A click on the button, which only appears on the player's turn | The player's turn |
| Target before you act | Points at an enemy and presses T | The player targets a token | Another visible token |
| The token menu | Right click on their token | The token menu of an owned token opens | Own token |
| Conditions | Clicks the status effects button of the menu. **Seen it** is there too | A click on that button | Own token |
| Elevation | Types a number into the elevation field of the menu, or **Seen it** | The elevation of the player's token changes | Own token |

### Useful extras

| Step | What the player does | How the module notices |
| --- | --- | --- |
| The macro bar | Clicks the bar, or **Seen it** | A click on the bar |
| Make a shortcut | Drags an item or a skill from the sheet onto a slot | The player creates a macro |
| The players list | Clicks the list, or **Seen it** | A click on the list |
| Pause | Reads it, **Seen it** | Only the button |
| Show everything | Holds Alt on the map, **Seen it** | Only the button |
| Pings and the GM | Reads that only the GM can pull everybody's view to a ping by holding Shift. **Seen it** | Only the button |

### Tips at the first fight

When the first fight starts, and again at the player's first turn, a short tip appears on the card: *A fight begins* and *It is your turn*, with **Show me** (starts the fight chapter), **Not now** and **No more tips**. A tip is shown only

* in a world that offers the guide on its own (not with *Only when I start it for a player* or *Never on its own*)
* to a player who has not said *I know Foundry* (stopping the guide or saying *Not now* does not silence the tips, only *I know Foundry* and *No more tips* do)
* until the player has done any step of the fight chapter, or finished it, and only if the GM offers that chapter
* when nothing else is on the card: a step, an offer or a flash is never replaced by a tip
* once per tip, and not at all when the player turned *Fight tips* off in the settings

The tip goes away by itself after 25 seconds. GMs never see tips.

### The card

* **Show me** shows where to look, with the ring. For a few steps it also opens what is needed: the sheet, a sidebar tab or a control layer. It never does the step for the player.
* **Seen it** marks a read step as done. **Skip** goes to the next step. **Stop the tour** puts the card away and keeps the steps done so far. It does not turn off the fight tips.
* The minus button folds the card to a small pill. The pill opens it again.
* Drag the card by its top line to move it. The place is remembered on this device.
* The gear opens the module settings.
* The card never appears by itself in the middle of a fight, except for the tip. A player who left a chapter half way finds it where they left off after a reload, folded to the pill while a fight is running (not in the fight chapter).

### Picking and replaying chapters

The question mark at the bottom of the token controls on the left opens the list of chapters at any time, also while a step is on the card. Close brings the step back. Picking another chapter pauses the running one: its progress stays, it shows as half done and a click on it goes on where it stopped. Switching never counts as stopping. Each row shows *New*, how many steps are done, or *Done, click to play again*. A click goes on where the player stopped, or starts a finished chapter again. A small button next to a half done chapter starts it from the beginning. The same list is in the module settings under *Guide for new players*. The help button can be switched off in the settings.

When a chapter ends, the card offers the next chapter, *Pick a chapter* and *Close*.

## For the GM

You never see a guide card by yourself. Open the player overview from the module settings (*Open the player overview*), from the question mark in the token controls, or with the macro.

### The overview

* **Players**: every player with their character, an online dot, a bar, how many chapters are done and a status: *Not started*, *Running*, *Finished*, *Stopped*, *Experienced* or *Asked later*. Under each player a button for every chapter shows how far the player is: *done*, *3 of 17* or *0 of 8*.
* **Offer a chapter**: click a chapter button of a player. The player is asked with a card of their own that names the chapter, decides when to start, and nothing interrupts them. It also works for a chapter the player has done before.
* **Offer the first chapter** (play button) is the same for the first chapter.
* **Mark as experienced** (cap button) means this player never gets the offer or a tip. A second click takes the mark away. A running guide disappears at once.
* **Forget the progress of this player** (back button) removes everything stored about the player. They count as new again.
* **Mark everybody as experienced** marks all players who have not met the guide yet. Players who already started keep their progress.
* **Try the guide myself** shows you the list of chapters as a preview. A preview stores nothing.
* **Chapters and steps offered**: untick a chapter to leave it out for everybody, or open it and untick single steps. The list of players who are half way adjusts at once, and a player who is in a chapter you turn off gets the card put away.

### A world that is already in use

When the module starts for the first time in a world with a running campaign (many chat messages or combats), it sets the offer to *Only when I start it for a player*, so your regulars are not surprised. In a fresh world the offer is on. Change it any time in the settings.

## Settings

The first button, *Sephral’s Modules*, and the module settings:

| Setting | Meaning |
| --- | --- |
| Module language | Language of the module on this device. |
| Look | The warm paper look (Signature) or the dark look of Foundry, per user. |
| Offer the tour | World setting. *To new players at their first login*, *Only when I start it for a player* or *Never on its own*. Tips at a fight follow it. |
| Help button | Shows the question mark in the token controls, per user. |
| Fight tips | Per user. Shows the tip at the first fight and at the first turn. |
| Open the player overview | GM. Opens the window with the players. |
| Guide for new players | Opens the list of chapters for you. A GM sees a preview, nothing is saved. |
| Self test, Save debug file | See below. |

## Self test

The settings button *Run self test* (GM) checks after a Foundry update that everything the module relies on is there: the window classes, the template, the chat styles, the sidebar tabs, the scene controls, the chat controls, the macro bar and the players list, the pings and the ruler of the map, and that user data can be written. It also tests the logic that recognizes the steps and the chapters and checks that every step and chapter has its texts. The module was verified with Foundry 14.370. When Foundry is newer, the GM gets a hint once.

## Debug file

For bug reports, the GM saves one file about all of Sephral’s modules in this world: `Save debug file` in the module settings, or `Save Debug File (Sephral’s Modules)` in the context menu of a chat message.

The file contains chat text and whispers. Check it before you share it.

## Sephral’s Modules

The first button in the module settings, *Sephral’s Modules* (GMs only), opens one window for all of Sephral's modules in the world: the version, self test, settings, manual and demo video of each, a button that switches on an installed module that is off (Foundry then reloads the world for everyone), and the debug file. Below, *More from Sephral* lists other modules that fit the game system of the world, shown only after a click, each with its demo video and an *Install* button. Foundry installs modules only on its setup screen, so the button copies the module's link (manifest URL) and shows the steps with a short clip. When the GM launches the world again, the window opens once with the new module and its *Enable* button. The list is part of the module. Only a video you start is loaded, from the module page on GitHub. If the GM agreed to the usage statistics, the window also counts how it is used: opened, the other modules shown, a video or install link of one of them, a module installed or switched on from it. It never records which module.


## Macro API

`game.modules.get("sephrals-first-table").api`

| Call | Does |
| --- | --- |
| `open()` | Opens the card for you: the step on it, or the list of chapters. A GM sees a preview. |
| `start({chapter, restart})` | Starts a chapter for you, the first one by default, from its first step with `restart: true`. A GM sees it as a preview. |
| `stop()` | Stops your guide. The steps done so far are kept. |
| `isRunning()` | Whether a step is on your card now. |
| `currentStep()` | The id of the step on your card, or `null`. |
| `currentChapter()` | The chapter that is running or was picked last, or an empty string. |
| `steps()` | The ids of the steps the GM offers, in order. |
| `chapters()` | The ids of the chapters the GM offers. |
| `chapterIds()` | The ids of all chapters: `basics`, `sidebar`, `controls`, `charsheet`, `chatdice`, `fight`, `extras`. |
| `stepIds()` | The ids of all steps, chapter by chapter. The first chapter keeps the ids `sheet`, `roll`, `moveKeys`, `moveDrag`, `target`, `ping`, `measure`, `chat`, `whisper`, `journal`. |
| `progress(user)` | The progress of a user (yourself by default): `status` (`running`, `finished`, `stopped`, `experienced`, `later` or empty), the steps `done` and `skipped`, the finished `chapters`, the shown `tips` and the times. |
| `startFor(user, chapter)` | GM. Offers a chapter (the first by default) to a player, like the chapter buttons in the overview. |
| `markExperienced(user)` | GM. Marks a player as experienced. |
| `reset(user)` | GM. Forgets everything stored about a player. |
| `openOverview()` | GM. Opens the player overview. |
| `runSelfTest()` | GM. Runs the self test. |
| `saveDebugFile()` | GM. Saves the debug file. |

The module stores the progress of each player with that player's user. Nothing is stored in actors, scenes, journals or the chat. The chapters and steps the GM turned off are world settings.

## Limits

* The guide waits for what the player does, so it needs a player who can do it: a character for the sheet steps, a token of the player on the viewed scene for the moving steps, another visible token for the target steps, and a fight for the fight steps. Otherwise the card says what is missing and the player can skip the step.
* A GM who restricts what players may do (no token movement outside the turn, no pings, no whispers, no macros) makes those steps impossible. Turn such steps off in the overview.
* The whisper step sends a real whisper to a GM. A short hello is enough. Turn the step off if you do not want whispers during the session.
* The elevation field of the token menu is locked for players while the game is paused or when the GM locks it. The step has a *Seen it* button for that.
* The ping is recognized when the player presses and holds on the map. A ping made from the combat tracker does not count.
* In Foundry 14 the arrow keys move the view and W, A, S and D move the token. In Foundry 13 the arrow keys move the selected token.
* The roll step goes on after any roll of the player, because it cannot tell where a roll came from. The sheet steps for D&D 5e (abilities, skills) look at the roll link the player clicked, and the step about typing looks at the command the player sent.
* The chapter *Your character sheet* knows the tab names of D&D 5e from live tests. Pathfinder 2e, SWADE and Crucible are matched by their usual tab names and the system texts were not tried in a running game. A step whose tab the sheet does not have is skipped by itself.
* The chat of the sidebar is the place for the step *Look at the dice*. A message that floats over the map while the sidebar is collapsed cannot be clicked, so the ring then marks the chat tab.
* Players who joined before the module was enabled are treated like everybody else in a world that is not in use yet. In a running campaign use *Mark everybody as experienced*.

## Usage statistics

The module can take part in a small usage report shared by all of Sephral’s modules. Nothing is counted or sent until the GM agrees: shortly after the world starts, the active GM is asked, and the question comes back at every start until there is an answer. The answer counts for all of Sephral’s modules in the world. *Share usage statistics* in the module settings turns the report on or off at any time, and *Manage statistics* below it shows what the report contains right now.

With the GM’s consent only the active GM’s browser counts, and it sends at most one report a day. The counts are kept in a hidden world setting, so all browsers and computers of the GM count together, and turning the statistics off deletes them. A copy of a world gets its own world ID. The question lists everything the report contains, from the Foundry version to a random world ID. For First Table it holds:

* on how many of the last 30 days the module was used
* how often a player starts, finishes or stops the guide, how many chapters are started and finished, how many steps are done or skipped, how many tips are shown, and how many players are marked as experienced (the active GM counts what the progress of the players shows, no names are sent)
* how often the GM offers a chapter or starts the guide for a player, changes the chapters or steps, opens the overview or tries the guide
* the settings *Offer the tour*, *Help button*, *Look* and *Fight tips* (only the chosen option)
* where errors occur in the module code: file, line, error type and whether the error arose in the module itself, in Foundry, in the game system or in another module, never the error message or the name of another module

No names, notes, pictures or other content of the world are sent.
