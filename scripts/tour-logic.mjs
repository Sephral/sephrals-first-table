/**
 * The pure logic of the tour: chapters and steps, a player's progress, what to offer and when, how actions are told
 * apart. Nothing here touches Foundry, so the unit tests run it as it is.
 */

/* -------------------------------------------- */
/*  Chapters and steps                          */
/* -------------------------------------------- */

/**
 * The chapters in the order they are offered, each with its steps in order. A step belongs to exactly one chapter.
 * The ten steps of the first chapter keep the ids of version 1.0.0, so stored progress stays valid.
 */
export const CHAPTERS = [
  {id: "basics", icon: "fa-solid fa-compass", steps: ["sheet", "roll", "moveKeys", "moveDrag", "target", "ping", "measure",
    "chat", "whisper", "journal"]},
  {id: "sidebar", icon: "fa-solid fa-table-columns", steps: ["sbChat", "sbMode", "sbCombat", "sbScenes", "sbPlaceables",
    "sbActors", "sbItems", "sbJournal", "sbTables", "sbCards", "sbMacros", "sbPlaylists", "sbVolume", "sbCompendium",
    "sbSettings", "sbConfigure", "sbControls"]},
  {id: "controls", icon: "fa-solid fa-toolbox", steps: ["scTokens", "scSelect", "scTarget", "scRuler", "scHelp", "scKeys", "scShapes",
    "scNotes"]},
  {id: "charsheet", icon: "fa-solid fa-id-card", steps: ["shOpen", "shAbilities", "shSkills", "shRest", "shTabs",
    "shInventory", "shItem", "shSpells", "shFeatures"]},
  {id: "chatdice", icon: "fa-solid fa-dice", steps: ["cdRoll", "cdInline", "cdOpen", "cdPrivate", "cdWhisper", "cdEmote"]},
  {id: "fight", icon: "fa-solid fa-swords", steps: ["fiTracker", "fiInitiative", "fiTurn", "fiEnd", "fiTarget", "fiHud",
    "fiConditions", "fiElevation"]},
  {id: "extras", icon: "fa-solid fa-star", steps: ["exHotbar", "exMacro", "exPlayers", "exPause", "exAlt", "exPing"]}
];

/** The ids of the chapters, in order. */
export const CHAPTER_IDS = CHAPTERS.map(chapter => chapter.id);

/** The ids of all steps, chapter by chapter. */
export const STEP_IDS = CHAPTERS.flatMap(chapter => chapter.steps);

/** The chapter a step belongs to. */
const CHAPTER_OF = Object.fromEntries(CHAPTERS.flatMap(chapter => chapter.steps.map(id => [id, chapter.id])));

/**
 * The tab names of the sheet by section. A step waits for a click on a tab of the player's character sheet with one of
 * these names, so different game systems with their own names are covered. A system that has none of them (or no tabs)
 * gets the step skipped by itself.
 */
export const SHEET_TABS = {
  inventory: ["inventory", "items", "gear", "equipment"],
  spells: ["spells", "spellcasting", "powers", "grimoire", "magic"],
  features: ["features", "feats", "edges", "talents", "traits"]
};

/**
 * What each step waits for.
 * - event: the action that completes it (see detect.mjs), "sheetTab:*" for a click on any tab of the sheet, empty for a
 *   step that is only read ("look"): the player marks it as seen.
 * - tabs: the section of SHEET_TABS the step waits for
 * - needs: what must exist for the player to be able to do it. "character" steps drop out when the player has no
 *   character at all, the others wait (the card says why and offers to skip).
 * - requires: keys of the context that must be true, otherwise the step is not offered at all (a tab the player does
 *   not see, a system the step is not meant for)
 * - icon: the icon on the card
 */
export const STEP_DEFS = {
  // Your first steps
  sheet: {event: "sheet", needs: ["character"], requires: [], icon: "fa-solid fa-id-card"},
  roll: {event: "roll", needs: ["character"], requires: [], icon: "fa-solid fa-dice-d20"},
  moveKeys: {event: "move:keys", needs: ["ownToken"], requires: [], icon: "fa-solid fa-keyboard"},
  moveDrag: {event: "move:drag", needs: ["ownToken"], requires: [], icon: "fa-solid fa-hand-pointer"},
  target: {event: "target", needs: ["otherToken"], requires: [], icon: "fa-solid fa-crosshairs"},
  ping: {event: "ping", needs: ["canvas"], requires: [], icon: "fa-solid fa-location-crosshairs"},
  measure: {event: "measure", needs: ["canvas"], requires: [], icon: "fa-solid fa-ruler"},
  chat: {event: "chat", needs: [], requires: [], icon: "fa-solid fa-comments"},
  whisper: {event: "whisper", needs: [], requires: [], icon: "fa-solid fa-user-secret"},
  journal: {event: "journal", needs: [], requires: [], icon: "fa-solid fa-book-open"},
  // The sidebar
  sbChat: {event: "tab:chat", needs: [], requires: ["tab:chat"], icon: "fa-solid fa-comments"},
  sbMode: {event: "rollmode", needs: [], requires: ["tab:chat", "ui:rollmode"], icon: "fa-solid fa-user-secret"},
  sbCombat: {event: "tab:combat", needs: [], requires: ["tab:combat"], icon: "fa-solid fa-swords"},
  sbScenes: {event: "tab:scenes", needs: [], requires: ["tab:scenes"], icon: "fa-solid fa-map"},
  sbPlaceables: {event: "tab:placeables", needs: [], requires: ["tab:placeables"], icon: "fa-solid fa-location-dot"},
  sbActors: {event: "tab:actors", needs: [], requires: ["tab:actors"], icon: "fa-solid fa-users"},
  sbItems: {event: "tab:items", needs: [], requires: ["tab:items"], icon: "fa-solid fa-suitcase"},
  sbJournal: {event: "tab:journal", needs: [], requires: ["tab:journal"], icon: "fa-solid fa-book-open"},
  sbTables: {event: "tab:tables", needs: [], requires: ["tab:tables"], icon: "fa-solid fa-list"},
  sbCards: {event: "tab:cards", needs: [], requires: ["tab:cards"], icon: "fa-solid fa-cards"},
  sbMacros: {event: "tab:macros", needs: [], requires: ["tab:macros"], icon: "fa-solid fa-code"},
  sbPlaylists: {event: "tab:playlists", needs: [], requires: ["tab:playlists"], icon: "fa-solid fa-music"},
  sbVolume: {event: "volume", needs: [], requires: ["tab:playlists"], icon: "fa-solid fa-volume-high"},
  sbCompendium: {event: "tab:compendium", needs: [], requires: ["tab:compendium"], icon: "fa-solid fa-atlas"},
  sbSettings: {event: "tab:settings", needs: [], requires: ["tab:settings"], icon: "fa-solid fa-gears"},
  sbConfigure: {event: "app:settings", needs: [], requires: ["tab:settings"], icon: "fa-solid fa-sliders"},
  sbControls: {event: "app:controls", needs: [], requires: ["tab:settings"], icon: "fa-solid fa-keyboard"},
  // The scene controls
  scTokens: {event: "control:tokens", needs: [], requires: ["control:tokens"], icon: "fa-solid fa-user"},
  scSelect: {event: "tool:select", needs: [], requires: ["tool:select"], icon: "fa-solid fa-expand"},
  scTarget: {event: "tool:target", needs: [], requires: ["tool:target"], icon: "fa-solid fa-bullseye"},
  scRuler: {event: "tool:ruler", needs: [], requires: ["tool:ruler"], icon: "fa-solid fa-ruler"},
  scKeys: {event: "app:controls", needs: [], requires: ["tab:settings"], icon: "fa-solid fa-keyboard"},
  scShapes: {event: "control:shapes", needs: [], requires: ["control:shapes"], icon: "fa-solid fa-ruler-combined"},
  scNotes: {event: "control:notes", needs: [], requires: ["control:notes"], icon: "fa-solid fa-bookmark"},
  scHelp: {event: "tool:sftHelp", needs: [], requires: ["tool:sftHelp"], icon: "fa-solid fa-circle-question"},
  // Your character sheet
  shOpen: {event: "sheet", needs: ["character"], requires: [], icon: "fa-solid fa-id-card"},
  shTabs: {event: "sheetTab:*", needs: ["character", "sheetOpen"], requires: [], icon: "fa-solid fa-folder-tree"},
  shAbilities: {event: "roll:ability", needs: ["character", "sheetOpen"], requires: ["system:dnd5e"],
    icon: "fa-solid fa-dumbbell"},
  shSkills: {event: "roll:skill", needs: ["character", "sheetOpen"], requires: ["system:dnd5e"], icon: "fa-solid fa-dice-d20"},
  shInventory: {tabs: "inventory", needs: ["character", "sheetOpen"], requires: [], icon: "fa-solid fa-suitcase"},
  shSpells: {tabs: "spells", needs: ["character", "sheetOpen"], requires: [], icon: "fa-solid fa-wand-sparkles"},
  shFeatures: {tabs: "features", needs: ["character", "sheetOpen"], requires: [], icon: "fa-solid fa-hand-fist"},
  shItem: {event: "item", look: true, needs: ["character", "sheetOpen"], requires: [], icon: "fa-solid fa-sack-xmark"},
  shRest: {event: "rest", needs: ["character", "sheetOpen"], requires: ["system:dnd5e"], icon: "fa-solid fa-bed"},
  // Chat and dice
  cdRoll: {event: "roll:typed", needs: [], requires: ["tab:chat"], icon: "fa-solid fa-dice"},
  cdInline: {event: "inline", needs: [], requires: ["tab:chat"], icon: "fa-solid fa-square-root-variable"},
  cdOpen: {event: "rollOpen", needs: ["rollCard"], requires: ["tab:chat"], icon: "fa-solid fa-magnifying-glass"},
  cdPrivate: {event: "roll:private", needs: [], requires: ["tab:chat", "ui:rollmode"], icon: "fa-solid fa-eye-slash"},
  cdWhisper: {event: "whisper:any", needs: [], requires: ["tab:chat"], icon: "fa-solid fa-comment-dots"},
  cdEmote: {event: "emote", needs: [], requires: ["tab:chat"], icon: "fa-solid fa-masks-theater"},
  // In a fight
  fiTracker: {event: "tab:combat", needs: ["combat"], requires: ["tab:combat"], icon: "fa-solid fa-swords"},
  fiInitiative: {event: "initiative", needs: ["myCombatant"], requires: ["tab:combat"], icon: "fa-solid fa-bolt"},
  fiTurn: {event: "turn:mine", look: true, needs: ["combat"], requires: ["tab:combat"], icon: "fa-solid fa-hourglass-half"},
  fiEnd: {event: "turnEnd", needs: ["myTurn"], requires: ["tab:combat"], icon: "fa-solid fa-forward-step"},
  fiTarget: {event: "target", needs: ["otherToken"], requires: [], icon: "fa-solid fa-crosshairs"},
  fiHud: {event: "hud", needs: ["ownToken"], requires: [], icon: "fa-solid fa-circle-dot"},
  fiConditions: {event: "hud:effects", look: true, needs: ["ownToken"], requires: [], icon: "fa-solid fa-face-dizzy"},
  fiElevation: {event: "elevation", look: true, needs: ["ownToken"], requires: [], icon: "fa-solid fa-mountain"},
  // Useful extras
  exHotbar: {event: "ui:hotbar", look: true, needs: [], requires: ["ui:hotbar"], icon: "fa-solid fa-bars"},
  exMacro: {event: "macro", needs: ["character"], requires: ["ui:hotbar"], icon: "fa-solid fa-hand-pointer"},
  exPlayers: {event: "ui:players", look: true, needs: [], requires: ["ui:players"], icon: "fa-solid fa-user-group"},
  exPause: {event: "", look: true, needs: [], requires: [], icon: "fa-solid fa-circle-pause"},
  exAlt: {event: "", look: true, needs: [], requires: [], icon: "fa-solid fa-lightbulb"},
  exPing: {event: "", look: true, needs: [], requires: [], icon: "fa-solid fa-location-crosshairs"}
};

/** The status of a player's tour. A player who never met the tour has no status at all. */
export const STATUS = {
  RUNNING: "running",
  FINISHED: "finished",
  STOPPED: "stopped",
  EXPERIENCED: "experienced",
  LATER: "later"
};

/** The tips that appear at the right moment of a fight. */
export const TIP_IDS = ["combatStart", "myTurn"];

/** How often a player who says "not now" is asked again at a later login. */
export const MAX_OFFERS = 2;

/** A move counts as "with the keys" when a key was pressed this many ms before the token moved. */
export const KEY_WINDOW = 2500;

/** A move counts as "dragged" when the pointer was used on the canvas this many ms before it. */
export const DRAG_WINDOW = 4000;

/** A roll counts as made from the sheet's roll link when the link was clicked this many ms before the message. */
export const SHEET_ROLL_WINDOW = 30000;

/** A roll or a message counts as typed when the player sent the text this many ms before the message. */
export const TYPED_WINDOW = 4000;

/** The key codes that move a token in a default Foundry. Custom bindings are added from the key bindings. */
export const DEFAULT_MOVE_CODES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD",
  "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad6", "Numpad7", "Numpad8", "Numpad9"];

/** The chat styles of typed messages (Foundry's CHAT_MESSAGE_STYLES: out of character, in character, emote). */
const TYPED_STYLES = [1, 2, 3];

/** The chat style of an emote. */
const EMOTE_STYLE = 3;

/** The chapter of a step ("" for an unknown step). */
export function chapterOf(stepId) {
  return CHAPTER_OF[stepId] ?? "";
}

/**
 * The steps of a chapter.
 * @param {string} chapterId
 * @returns {string[]}
 */
export function chapterSteps(chapterId) {
  return CHAPTERS.find(chapter => chapter.id === chapterId)?.steps ?? [];
}

/* -------------------------------------------- */
/*  Progress                                    */
/* -------------------------------------------- */

/**
 * Clean a stored progress record.
 * @param {*} raw
 * @returns {{status: string, steps: Record<string, string>, chapter: string, chapters: string[], tips: string[],
 *   started: number, finished: number, updated: number, offers: number, handledInvite: number}}
 */
export function cleanProgress(raw) {
  const source = (raw && (typeof raw === "object")) ? raw : {};
  const steps = {};
  for ( const [id, state] of Object.entries(source.steps ?? {}) ) {
    if ( STEP_IDS.includes(id) && ((state === "done") || (state === "skipped")) ) steps[id] = state;
  }
  // The stored form keeps two lists, because Foundry replaces lists in an update and merges objects
  for ( const [list, state] of [[source.skipped, "skipped"], [source.done, "done"]] ) {
    if ( Array.isArray(list) ) for ( const id of list ) if ( STEP_IDS.includes(id) ) steps[id] = state;
  }
  const status = Object.values(STATUS).includes(source.status) ? source.status : "";
  const num = value => ((Number.isFinite(value) && (value > 0)) ? value : 0);
  const list = (value, allowed) => (Array.isArray(value) ? allowed.filter(id => value.includes(id)) : []);
  return {status, steps, chapter: CHAPTER_IDS.includes(source.chapter) ? source.chapter : "",
    chapters: list(source.chapters, CHAPTER_IDS), tips: list(source.tips, TIP_IDS), started: num(source.started),
    finished: num(source.finished), updated: num(source.updated), offers: Math.floor(num(source.offers)),
    handledInvite: num(source.handledInvite)};
}

/**
 * The form of a progress record in the user's flag: the steps as two lists.
 * @param {*} progress
 * @returns {object}
 */
export function storedProgress(progress) {
  const {steps, ...rest} = cleanProgress(progress);
  return {...rest, done: STEP_IDS.filter(id => steps[id] === "done"), skipped: STEP_IDS.filter(id => steps[id] === "skipped")};
}

/**
 * The player starts a chapter, or starts it again from its first step.
 * @param {*} prev
 * @param {number} now
 * @param {object} [options]
 * @param {boolean} [options.restart=false]   Forget the steps of the chapter done so far
 * @param {string} [options.chapter]          The chapter, the one running before or the first by default
 * @param {boolean} [options.all=false]       Forget the steps of all chapters (a GM's preview)
 * @returns {object}
 */
export function startProgress(prev, now, {restart = false, chapter, all = false} = {}) {
  const p = cleanProgress(prev);
  const id = CHAPTER_IDS.includes(chapter) ? chapter : (p.chapter || CHAPTER_IDS[0]);
  const wipe = new Set(all ? STEP_IDS : (restart ? chapterSteps(id) : []));
  const steps = Object.fromEntries(Object.entries(p.steps).filter(([step]) => !wipe.has(step)));
  const chapters = all ? [] : (restart ? p.chapters.filter(c => c !== id) : p.chapters);
  const fresh = all || (restart && !p.started);
  return {...p, status: STATUS.RUNNING, steps, chapter: id, chapters, started: fresh ? now : (p.started || now),
    finished: 0, updated: now};
}

/**
 * A step is done or skipped.
 * @param {*} prev
 * @param {string} id
 * @param {"done"|"skipped"} state
 * @param {number} now
 * @returns {object}
 */
export function markStep(prev, id, state, now) {
  const p = cleanProgress(prev);
  if ( !STEP_IDS.includes(id) ) return p;
  return {...p, steps: {...p.steps, [id]: state}, updated: now};
}

/**
 * The last step of a chapter is behind the player.
 * @param {*} prev
 * @param {number} now
 * @param {string} [chapter]   The chapter, the running one by default
 */
export function finishProgress(prev, now, chapter) {
  const p = cleanProgress(prev);
  const id = CHAPTER_IDS.includes(chapter) ? chapter : (p.chapter || CHAPTER_IDS[0]);
  return {...p, status: STATUS.FINISHED, chapter: id, chapters: CHAPTER_IDS.filter(c => (c === id) || p.chapters.includes(c)),
    finished: now, updated: now};
}

/** The player stops the tour. The steps stay, so it can go on later. */
export function stopProgress(prev, now) {
  return {...cleanProgress(prev), status: STATUS.STOPPED, updated: now};
}

/** The player says "not now" to the offer. */
export function laterProgress(prev, now) {
  const p = cleanProgress(prev);
  const offers = p.offers + 1;
  return {...p, status: offers >= MAX_OFFERS ? STATUS.STOPPED : STATUS.LATER, offers, updated: now};
}

/** The player (or the GM) says this is not new to them. */
export function experiencedProgress(prev, now) {
  return {...cleanProgress(prev), status: STATUS.EXPERIENCED, updated: now};
}

/** A tip was shown to the player. */
export function tipShownProgress(prev, tip, now) {
  const p = cleanProgress(prev);
  if ( !TIP_IDS.includes(tip) || p.tips.includes(tip) ) return p;
  return {...p, tips: TIP_IDS.filter(id => (id === tip) || p.tips.includes(id)), updated: now};
}

/**
 * What to show a player now.
 * @param {object} context
 * @param {*} context.progress     The stored progress
 * @param {string} context.mode    The world option: "auto", "gm" or "off"
 * @param {boolean} context.isGM   GMs are never offered anything
 * @param {number} [context.invite]   When the GM started the tour for this player (0 for none)
 * @returns {"invited"|"resume"|"offer"|null}
 */
export function offerKind({progress, mode, isGM, invite = 0}) {
  if ( isGM ) return null;
  const p = cleanProgress(progress);
  if ( p.status === STATUS.RUNNING ) return "resume";
  if ( invite > p.handledInvite ) return "invited";
  if ( mode !== "auto" ) return null;
  if ( !p.status || (p.status === STATUS.LATER) ) return "offer";
  return null;
}

/**
 * The chapter a GM's invitation names.
 * @param {*} stored   The stored value of the invitation's chapter
 * @returns {string}
 */
export function inviteChapter(stored) {
  return CHAPTER_IDS.includes(stored) ? stored : CHAPTER_IDS[0];
}

/**
 * Is a world already in use? The module then does not offer the tour on its own, because the players know the table.
 * @param {{messages: number, combats: number}} counts
 * @returns {boolean}
 */
export function isEstablished({messages = 0, combats = 0} = {}) {
  return (combats > 0) || (messages >= 30);
}

/**
 * Is a tip due at this moment of a fight? Not to players marked as experienced, in a world that offers the tour on its
 * own, and only until they know the fight chapter. Stopping a chapter does not matter.
 * @param {object} context
 * @param {string} context.tip              "combatStart" or "myTurn"
 * @param {*} context.progress              The stored progress
 * @param {string} context.mode             The world option: "auto", "gm" or "off"
 * @param {boolean} context.isGM
 * @param {boolean} [context.enabled=true]  The player's own switch for tips
 * @param {string[]} [context.chapters]     The chapters the GM offers
 * @param {string[]} [context.offered]      The steps the GM offers
 * @returns {boolean}
 */
export function tipDue({tip, progress, mode, isGM, enabled = true, chapters = CHAPTER_IDS, offered = STEP_IDS}) {
  if ( isGM || !enabled || (mode !== "auto") || !TIP_IDS.includes(tip) ) return false;
  const p = cleanProgress(progress);
  // Stopping the guide or saying "not now" to the offer does not silence the tips, only "I know Foundry" does
  if ( p.status === STATUS.EXPERIENCED ) return false;
  if ( p.tips.includes(tip) || p.chapters.includes("fight") ) return false;
  if ( !chapters.includes("fight") ) return false;
  const steps = chapterSteps("fight").filter(id => offered.includes(id));
  if ( !steps.length ) return false;
  return !steps.some(id => p.steps[id]);
}

/* -------------------------------------------- */
/*  Plan                                        */
/* -------------------------------------------- */

/**
 * The steps this player has in a chapter now.
 * @param {object} options
 * @param {string[]} options.offered     The steps the GM offers
 * @param {*} options.progress           The player's progress
 * @param {Record<string, boolean>} options.ctx   What exists, see tour.mjs (context)
 * @param {string} [options.chapter]     The chapter, all steps of all chapters when left out
 * @returns {{id: string, state: "todo"|"done"|"skipped", missing: string[]}[]}
 */
export function planSteps({offered, progress, ctx, chapter}) {
  const steps = cleanProgress(progress).steps;
  const plan = [];
  for ( const id of (chapter ? chapterSteps(chapter) : STEP_IDS) ) {
    if ( !offered.includes(id) ) continue;
    const def = STEP_DEFS[id];
    if ( def.needs.includes("character") && !ctx.character ) continue;
    if ( def.requires.some(key => !ctx[key]) ) continue;
    plan.push({id, state: steps[id] ?? "todo", missing: def.needs.filter(need => (need !== "character") && !ctx[need])});
  }
  return plan;
}

/**
 * The first step still to do.
 * @param {{id: string, state: string}[]} plan
 * @returns {object|null}
 */
export function currentStep(plan) {
  return plan.find(step => step.state === "todo") ?? null;
}

/**
 * Count the steps of a plan.
 * @param {{state: string}[]} plan
 * @returns {{total: number, done: number, skipped: number, left: number}}
 */
export function counts(plan) {
  const done = plan.filter(step => step.state === "done").length;
  const skipped = plan.filter(step => step.state === "skipped").length;
  return {total: plan.length, done, skipped, left: plan.length - done - skipped};
}

/**
 * The offered steps from the world setting.
 * @param {*} stored   {disabled: string[]}
 * @returns {string[]}
 */
export function offeredSteps(stored) {
  const disabled = new Set(Array.isArray(stored?.disabled) ? stored.disabled : []);
  return STEP_IDS.filter(id => !disabled.has(id));
}

/**
 * The setting value for a list of offered steps.
 * @param {string[]} offered
 * @returns {{disabled: string[]}}
 */
export function stepsSetting(offered) {
  return {disabled: STEP_IDS.filter(id => !offered.includes(id))};
}

/**
 * The offered chapters from the world setting.
 * @param {*} stored   {disabled: string[]}
 * @returns {string[]}
 */
export function offeredChapters(stored) {
  const disabled = new Set(Array.isArray(stored?.disabled) ? stored.disabled : []);
  return CHAPTER_IDS.filter(id => !disabled.has(id));
}

/**
 * The setting value for a list of offered chapters.
 * @param {string[]} offered
 * @returns {{disabled: string[]}}
 */
export function chaptersSetting(offered) {
  return {disabled: CHAPTER_IDS.filter(id => !offered.includes(id))};
}

/**
 * A context in which every step is possible, for the GM's overview, which cannot see another player's screen.
 * @param {string} systemId   The game system of the world
 * @returns {Record<string, boolean>}
 */
export function permissiveContext(systemId) {
  const keys = new Set(["character", "ownToken", "otherToken", "canvas", "combat", "myCombatant", "myTurn", "sheetOpen", "rollCard"]);
  for ( const def of Object.values(STEP_DEFS) ) for ( const key of def.requires ) keys.add(key);
  return Object.fromEntries([...keys].map(key => [key, key.startsWith("system:") ? (key === `system:${systemId}`) : true]));
}

/**
 * The events a step accepts.
 * @param {string} stepId
 * @returns {string[]}
 */
export function stepEvents(stepId) {
  const def = STEP_DEFS[stepId];
  if ( !def ) return [];
  if ( def.tabs ) return (SHEET_TABS[def.tabs] ?? []).map(name => `sheetTab:${name}`);
  return def.event ? [def.event] : [];
}

/**
 * Does an action complete a step?
 * @param {string} stepId
 * @param {string} event   "sheet", "roll", "move:keys", "tab:chat", ...
 * @returns {boolean}
 */
export function completes(stepId, event) {
  const def = STEP_DEFS[stepId];
  if ( !def || !event ) return false;
  if ( def.event === "sheetTab:*" ) return event.startsWith("sheetTab:");
  return stepEvents(stepId).includes(event);
}

/**
 * Does a step wait for an event of this kind? The detection uses it to run costly listeners only when needed.
 * @param {string} stepId
 * @param {string} prefix   "move", "ping", "sheetTab", ...
 * @returns {boolean}
 */
export function wantsEvent(stepId, prefix) {
  const def = STEP_DEFS[stepId];
  if ( !def ) return false;
  if ( def.event === "sheetTab:*" ) return prefix === "sheetTab";
  return stepEvents(stepId).some(event => (event === prefix) || event.startsWith(`${prefix}:`));
}

/**
 * The language key for a part of a step: a text for the game system when there is one, then one for the Foundry
 * generation (the keys that move a token differ), then the general text.
 * @param {string} stepId
 * @param {string} systemId
 * @param {(key: string) => boolean} has   Whether a key exists
 * @param {number} [generation]            Foundry's generation, 13 or 14
 * @param {string} [part="do"]             "do", "text", ...
 * @returns {string}
 */
export function doKey(stepId, systemId, has, generation = 0, part = "do") {
  const base = `SFT.STEPS.${stepId}.${part}`;
  const cap = String(systemId ?? "").replace(/[^a-z0-9]/gi, "");
  const system = `${base}${cap.charAt(0).toUpperCase()}${cap.slice(1).toLowerCase()}`;
  if ( cap && has(system) ) return system;
  const version = `${base}V${generation}`;
  return (generation && has(version)) ? version : base;
}

/**
 * Text keys of a step that has its own "done" line, otherwise the general one.
 * @param {string} stepId
 * @param {(key: string) => boolean} has
 * @returns {string}
 */
export function doneKey(stepId, has) {
  const key = `SFT.STEPS.${stepId}.done`;
  return has(key) ? key : "SFT.card.doneGeneral";
}

/* -------------------------------------------- */
/*  Telling actions apart                       */
/* -------------------------------------------- */

/**
 * Did a token move because of the keys or because of the pointer?
 * @param {object} times
 * @param {number} times.now
 * @param {number} times.lastKeyAt       When a movement key last went down (0 for never)
 * @param {number} times.lastPointerAt   When the pointer last went down or up on the canvas (0 for never)
 * @param {boolean} [times.keyDown]      A movement key is held down right now
 * @returns {"keys"|"drag"|"other"}
 */
export function classifyMove({now, lastKeyAt = 0, lastPointerAt = 0, keyDown = false}) {
  const keyAge = lastKeyAt ? now - lastKeyAt : Infinity;
  const pointerAge = lastPointerAt ? now - lastPointerAt : Infinity;
  const byKey = keyDown || (keyAge <= KEY_WINDOW);
  const byPointer = pointerAge <= DRAG_WINDOW;
  if ( byKey && (!byPointer || keyDown || (keyAge <= pointerAge)) ) return "keys";
  if ( byPointer ) return "drag";
  return "other";
}

/**
 * What a chat message of this player means for the tour.
 * @param {object} message
 * @param {string} message.authorId
 * @param {number} [message.rolls]       Number of rolls
 * @param {string[]} [message.whisper]   Recipients
 * @param {number} [message.style]       Foundry's chat style
 * @param {string} [message.content]     The text of the message
 * @param {string} [message.typed]       What the player typed a moment ago ("" for nothing)
 * @param {string} [message.sheetRoll]   The kind of roll link the player clicked on the sheet a moment ago ("ability",
 *   "skill", ...) or ""
 * @param {object} who
 * @param {string} who.userId            The player
 * @param {(id: string) => boolean} who.isGm   Is this user a GM?
 * @returns {string[]}   The events: "roll", "roll:<kind>" for a roll link of the sheet, "roll:typed" for a roll typed
 *   as a command, "roll:private" for a roll only some people see, "chat" (typed text, also whispered), "whisper" (to a
 *   GM), "whisper:any" (a whisper to anybody), "emote", "inline" (a roll written into a message)
 */
export function chatEvents(message, {userId, isGm}) {
  if ( message?.authorId !== userId ) return [];
  const events = [];
  const whisper = Array.isArray(message.whisper) ? message.whisper : [];
  if ( message.rolls > 0 ) {
    events.push("roll");
    if ( message.sheetRoll ) events.push(`roll:${message.sheetRoll}`);
    if ( message.typed && /^\/\s*(r|roll|gmr|gmroll|publicroll|pr|selfroll|sr|blindroll|br)\b/i.test(message.typed.trim()) ) {
      events.push("roll:typed");
    }
    if ( whisper.length > 0 ) events.push("roll:private");
  }
  else {
    if ( TYPED_STYLES.includes(message.style) || (whisper.length > 0) ) events.push("chat");
    if ( whisper.some(id => isGm(id)) ) events.push("whisper");
    if ( whisper.length > 0 ) events.push("whisper:any");
    if ( message.style === EMOTE_STYLE ) events.push("emote");
    if ( /\[\[\s*[^\]\s][^\]]*\]\]/.test(String(message.typed || message.content || "")) ) events.push("inline");
  }
  return events;
}

/**
 * Is a ruler measuring something? Two points at different places.
 * @param {{x: number, y: number}[]|undefined} path
 * @returns {boolean}
 */
export function isMeasuring(path) {
  if ( !Array.isArray(path) || (path.length < 2) ) return false;
  const first = path[0];
  return path.some(point => (point.x !== first.x) || (point.y !== first.y));
}

/**
 * Was a ping just drawn by this player? The pointer went down on the canvas shortly before.
 * @param {object} times
 * @param {number} times.now
 * @param {number} times.pointerDownAt   When the pointer last went down on the canvas (0 for never)
 * @param {number} [times.window=3000]
 * @returns {boolean}
 */
export function isOwnPing({now, pointerDownAt, window = 3000}) {
  return !!pointerDownAt && ((now - pointerDownAt) <= window);
}

/**
 * The scene control layer a click on a control button means. Shapes are called "templates" in Foundry 13 and "regions"
 * in Foundry 14.
 * @param {string} name   The button's data-control
 * @returns {string}
 */
export function controlEvent(name) {
  return `control:${["templates", "regions"].includes(name) ? "shapes" : name}`;
}

/**
 * Which kind of Foundry window is this? For the steps that wait for the settings windows.
 * @param {{id?: string, name?: string}} app   The window's id and class name
 * @returns {"settings"|"controls"|""}
 */
export function appKind({id = "", name = ""} = {}) {
  if ( id === "controls" || /^ControlsConfig$/.test(name) ) return "controls";
  if ( id === "client-settings" || /^SettingsConfig$/.test(name) ) return "settings";
  return "";
}

/* -------------------------------------------- */
/*  The GM's overview                           */
/* -------------------------------------------- */

/**
 * How far a player is in a chapter.
 * @param {*} progress
 * @param {string} chapterId
 * @param {{offered: string[], ctx: Record<string, boolean>}} options
 * @returns {{id: string, done: number, skipped: number, total: number, finished: boolean, state: "new"|"part"|"done"}}
 */
export function chapterSummary(progress, chapterId, {offered, ctx}) {
  const p = cleanProgress(progress);
  const plan = planSteps({offered, progress: p, ctx, chapter: chapterId});
  const c = counts(plan);
  const finished = p.chapters.includes(chapterId) || ((c.total > 0) && (c.left === 0));
  const state = finished ? "done" : ((c.done + c.skipped) > 0 ? "part" : "new");
  return {id: chapterId, done: c.done, skipped: c.skipped, total: c.total, finished, state};
}

/**
 * What the GM sees of one player.
 * @param {*} progress
 * @param {{offered: string[], chapters?: string[], ctx: Record<string, boolean>}} options
 * @returns {{status: string, done: number, skipped: number, total: number, percent: number, chaptersDone: number,
 *   chaptersTotal: number, chapters: object[]}}
 */
export function playerSummary(progress, {offered, chapters = CHAPTER_IDS, ctx}) {
  const p = cleanProgress(progress);
  const list = chapters.map(id => chapterSummary(p, id, {offered, ctx}));
  const total = list.reduce((sum, c) => sum + c.total, 0);
  const passed = list.reduce((sum, c) => sum + (c.finished ? c.total : c.done + c.skipped), 0);
  return {status: p.status || "new", done: list.reduce((sum, c) => sum + c.done, 0),
    skipped: list.reduce((sum, c) => sum + c.skipped, 0), total, percent: total ? Math.round((passed / total) * 100) : 0,
    chaptersDone: list.filter(c => c.finished).length, chaptersTotal: list.length, chapters: list};
}

/**
 * What changed between two states of a player's progress, for the usage counters on the GM's side.
 * @param {*} prev
 * @param {*} next
 * @returns {{done: number, skipped: number, started: boolean, finished: boolean, stopped: boolean,
 *   experienced: boolean, chapterStarted: boolean, chapterFinished: number, tips: number}}
 */
export function progressDelta(prev, next) {
  const a = cleanProgress(prev);
  const b = cleanProgress(next);
  const changed = state => Object.entries(b.steps).filter(([id, value]) => (value === state) && (a.steps[id] !== state)).length;
  const running = (b.status === STATUS.RUNNING);
  return {
    done: changed("done"),
    skipped: changed("skipped"),
    started: running && (a.status !== STATUS.RUNNING),
    finished: (b.status === STATUS.FINISHED) && (a.status !== STATUS.FINISHED),
    stopped: (b.status === STATUS.STOPPED) && (a.status !== STATUS.STOPPED),
    experienced: (b.status === STATUS.EXPERIENCED) && (a.status !== STATUS.EXPERIENCED),
    chapterStarted: running && ((a.status !== STATUS.RUNNING) || (a.chapter !== b.chapter)),
    chapterFinished: b.chapters.filter(id => !a.chapters.includes(id)).length,
    tips: b.tips.filter(id => !a.tips.includes(id)).length
  };
}
