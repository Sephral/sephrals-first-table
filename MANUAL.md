# Sephral’s First Table: Manual

First Table gives every new player a short guided first session. A small card in the corner of the screen walks them through the basics, one step at a time, and goes on only when the player has really done what the step asks for. The GM does nothing: the tour is offered at the player's first login. Nothing is changed in actors, scenes, journals or the chat. The module only remembers how far each player got.

## The tour for players

At the first login a new player sees a small card with three answers:

* **Show me around** starts the tour.
* **Not now** closes the card. The player is asked once more at a later login, then never again by itself.
* **I know Foundry** closes the card for good.

The tour has ten steps. Each step has a title, one or two sentences of explanation, what to do, and a ring that shows where to look. The ring is only a hint: it does not block clicks.

| Step | What the player does | How the module notices |
| --- | --- | --- |
| This is your character | Opens the character sheet, by double click on the token, the key C or the Actors tab | A window with an actor the player owns opens |
| Roll the dice | Rolls from the sheet, a skill or an ability | The player makes a roll that lands in the chat |
| Move with the keys | Moves the selected token with the arrow keys or W, A, S, D | The player's token moves while a movement key was just pressed |
| Move by dragging | Drags the token to another square | The player's token moves after the pointer was used on the map |
| Pick a target | Hovers over another token and presses T | The player targets a token |
| Ping the map | Presses and holds the mouse button on the map | A ping appears while the player holds the pointer on the map |
| Measure a distance | Picks the ruler and drags across the map | The player's ruler shows a distance |
| Say something in the chat | Writes a line, best as a whisper to themselves | The player sends a typed message |
| Whisper to the GM | Types /w gm and a message | The player sends a whisper to a GM |
| Journals and handouts | Opens the Journal tab and an entry | The Journal tab or a journal opens |

The roll step names what to click in the game system of your world: D&D 5e, Pathfinder 2e, SWADE and Crucible have their own text, every other system gets a general one. The step goes on after any roll the player makes.

The step *This is your character* and the roll step only appear for players who have a character, the one the GM assigned or any actor the player owns. The steps about tokens wait when the viewed scene has no token of the player, or no other token to target. The card then says why and the player can skip the step or wait until the GM puts a token on the map.

### The card

* **Show me** shows where to look, for example with the ring around the token, and for the roll step it opens the sheet. It never does the step for the player.
* **Skip** goes to the next step. **Stop the tour** puts the card away and keeps the steps done so far.
* The minus button folds the card to a small pill. The pill opens it again.
* Drag the card by its top line to move it. The place is remembered on this device.
* The gear opens the module settings.
* The card never appears in the middle of a fight. A player who left the tour half way finds it where they left off after a reload, folded to the pill while a fight is running.

### Starting again

A small question mark at the bottom of the token controls on the left opens the tour card: *Start the tour*, *Go on* where it stopped, or *Start again*. The same is in the module settings under *Quick tour for new players*. The help button can be switched off in the settings.

## For the GM

You never see a tour card by yourself. Open the player overview from the module settings (*Open the player overview*), from the question mark in the token controls, or with the macro.

### The overview

* **Players**: every player with their character, an online dot, a progress bar and a status: *Not started*, *Running*, *Finished*, *Stopped*, *Experienced* or *Asked later*.
* **Start the tour for this player** (play button) asks the player with a card of their own. The player decides when to start, nothing interrupts them. It also works for a player who finished or stopped before.
* **Mark as experienced** (cap button) means this player never gets the offer. A second click takes the mark away. A running tour disappears at once.
* **Forget the tour for this player** (back button) removes everything stored about the player. They count as new again.
* **Mark everybody as experienced** marks all players who have not met the tour yet. Players who already started keep their progress.
* **Try the tour myself** shows you the tour as a preview. A preview stores nothing.
* **Steps offered**: untick a step to leave it out for everybody. The tour of players who are half way adjusts at once.

### A world that is already in use

When the module starts for the first time in a world with a running campaign (many chat messages or combats), it sets the offer to *Only when I start it for a player*, so your regulars are not surprised. In a fresh world the offer is on. Change it any time in the settings.

## Settings

The first button, *Sephral’s Modules*, and the module settings:

| Setting | Meaning |
| --- | --- |
| Module language | Language of the module on this device. |
| Look | The warm paper look (Signature) or the dark look of Foundry, per user. |
| Offer the tour | World setting. *To new players at their first login*, *Only when I start it for a player* or *Never on its own*. |
| Help button | Shows the question mark in the token controls, per user. |
| Open the player overview | GM. Opens the window with the players. |
| Quick tour for new players | Opens the tour card for you. A GM sees the tour as a preview. |
| Self test, Save debug file | See below. |

## Self test

The settings button *Run self test* (GM) checks after a Foundry update that everything the module relies on is there: the window classes, the template, the chat styles, the sidebar, the pings and the ruler of the map, and that user data can be written. It also tests the logic that recognizes the steps and checks that every step has its texts. The module was verified with Foundry 14.370. When Foundry is newer, the GM gets a hint once.

## Debug file

For bug reports, the GM saves one file about all of Sephral’s modules in this world: `Save debug file` in the module settings, or `Save Debug File (Sephral’s Modules)` in the context menu of a chat message.

The file contains chat text and whispers. Check it before you share it.

## Sephral’s Modules

The first button in the module settings, *Sephral’s Modules* (GMs only), opens one window for all of Sephral's modules in the world: the version, self test, settings, manual and demo video of each, a button that switches on an installed module that is off (Foundry then reloads the world for everyone), and the debug file. Below, *More from Sephral* lists other modules that fit the game system of the world, shown only after a click, each with its demo video and an *Install* button. Foundry installs modules only on its setup screen, so the button copies the module's link (manifest URL) and shows the steps with a short clip. When the GM launches the world again, the window opens once with the new module and its *Enable* button. The list is part of the module. Only a video you start is loaded, from the module page on GitHub.


## Macro API

`game.modules.get("sephrals-first-table").api`

| Call | Does |
| --- | --- |
| `open()` | Opens the tour card for you: the first step, going on, or the menu. A GM sees the tour as a preview. |
| `start({restart})` | Starts the tour for you, from the first step with `restart: true`. A GM sees it as a preview. |
| `stop()` | Stops your tour. The steps done so far are kept. |
| `isRunning()` | Whether a step is on your card now. |
| `currentStep()` | The id of the step on your card, or `null`. |
| `steps()` | The ids of the steps the GM offers, in order. |
| `stepIds()` | The ids of all steps: `sheet`, `roll`, `moveKeys`, `moveDrag`, `target`, `ping`, `measure`, `chat`, `whisper`, `journal`. |
| `progress(user)` | The progress of a user (yourself by default): `status` (`running`, `finished`, `stopped`, `experienced`, `later` or empty), the steps `done` and `skipped`, and the times. |
| `startFor(user)` | GM. Asks a player to take the tour, like the play button in the overview. |
| `markExperienced(user)` | GM. Marks a player as experienced. |
| `reset(user)` | GM. Forgets everything stored about a player. |
| `openOverview()` | GM. Opens the player overview. |
| `runSelfTest()` | GM. Runs the self test. |
| `saveDebugFile()` | GM. Saves the debug file. |

The module stores the progress of each player with that player's user. Nothing is stored in actors, scenes, journals or the chat. The steps the GM turned off are a world setting.

## Limits

* The tour waits for what the player does, so it needs a player who can do it: a character for the first two steps, a token of the player on the viewed scene for the moving steps, and another visible token for the target step. Otherwise the card says what is missing and the player can skip the step.
* A GM who restricts what players may do (no token movement outside the turn, no pings, no whispers) makes those steps impossible. Turn such steps off in the overview.
* The whisper step sends a real whisper to a GM. A short hello is enough. Turn the step off if you do not want whispers during the session.
* The ping is recognized when the player presses and holds on the map. A ping made from the combat tracker does not count.
* In Foundry 14 the arrow keys move the view and W, A, S and D move the token. In Foundry 13 the arrow keys move the selected token.
* The roll step goes on after any roll of the player, also one typed as `/r 1d20`, because it cannot tell where a roll came from.
* Players who joined before the module was enabled are treated like everybody else in a world that is not in use yet. In a running campaign use *Mark everybody as experienced*.
* The tour stays out of the way while a fight is running: it does not offer itself then, and a started tour waits folded.

## Usage statistics

The module can take part in a small usage report shared by all of Sephral’s modules. Nothing is counted or sent until the GM agrees: shortly after the world starts, the active GM is asked, and the question comes back at every start until there is an answer. The answer counts for all of Sephral’s modules in the world. *Share usage statistics* in the module settings turns the report on or off at any time, and *Manage statistics* below it shows what the report contains right now.

With the GM’s consent only the active GM’s browser counts, and it sends at most one report a day. The counts are kept in a hidden world setting, so all browsers and computers of the GM count together, and turning the statistics off deletes them. A copy of a world gets its own world ID. The question lists everything the report contains, from the Foundry version to a random world ID. For First Table it holds:

* on how many of the last 30 days the module was used
* how often a player starts, finishes or stops the tour, how many steps are done or skipped, and how many players are marked as experienced (the active GM counts what the progress of the players shows, no names are sent)
* how often the GM starts the tour for a player, changes the steps, opens the overview or tries the tour
* the settings *Offer the tour*, *Help button* and *Look* (only the chosen option)
* where errors occur in the module code: file, line, error type and whether the error arose in the module itself, in Foundry, in the game system or in another module, never the error message or the name of another module

No names, notes, pictures or other content of the world are sent.
