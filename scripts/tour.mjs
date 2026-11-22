/**
 * The tour of one player: offers it, runs the steps of a chapter, waits for what the player does, stores the progress and
 * counts for the GM. The card is small, folds to a pill, and every step can be skipped, so the tour never takes over a
 * game. A short tip at the first fight points to the fight chapter at the moment it is useful.
 */

import {MODULE_ID, setting, t} from "./config.mjs";
import {currentPlace, hideCard, hideRing, isShown, keepOnScreen, onAction, rectOfElement, rectOfSelector, rectOfToken,
  setPlace, shownMode, showCard, showRing} from "./card.mjs";
import {eventOf, listenFor, registerDetection} from "./detect.mjs";
import {inviteChapterOf, inviteOf, progressOf, saveProgress, touchesFlags} from "./progress.mjs";
import {CHAPTERS, CHAPTER_IDS, SHEET_TABS, STATUS, STEP_DEFS, chapterSummary, completes, counts, currentStep, doKey, doneKey,
  experiencedProgress, finishProgress, laterProgress, markStep, offerKind, offeredChapters, offeredSteps, permissiveContext,
  planSteps, startProgress, stopProgress, tipDue, tipShownProgress, wantsEvent} from "./tour-logic.mjs";
import {trace} from "./trace.mjs";

/** Wait before a card appears on its own after the world is ready, in ms. */
const OFFER_DELAY = 6000;

/** How long the "done" check stays before the next step, in ms. */
const FLASH_MS = 1300;

/** The finish card goes away by itself after this many ms. */
const DONE_MS = 30000;

/** A tip goes away by itself after this many ms. */
const TIP_MS = 25000;

/** The sidebar tabs the steps know. */
const TABS = ["chat", "combat", "scenes", "placeables", "actors", "items", "journal", "tables", "cards", "macros",
  "playlists", "compendium", "settings"];

/** The state of the tour on this client. */
const state = {
  /** The tour runs in preview: a GM looks at it, nothing is stored. */
  preview: false,
  /** The progress as this client knows it. */
  progress: null,
  /** The chapter that is running or was picked last. */
  chapter: "",
  /** The step on the card now, or null. */
  step: null,
  /** What the card shows: "step", "offer", "invited", "menu", "done", "tip" or "" for nothing. */
  view: "",
  /** The menu was opened over a running step, which Close brings back. */
  paused: false,
  /** The tip on the card, when there is one. */
  tip: "",
  /** What the current step waits for before it can be done, for the check after a scene change. */
  missing: "",
  /** The step and its waiting state the ring was last drawn for. */
  ringKey: "",
  folded: false,
  timers: new Set(),
  started: false
};

/** Called when the tour wants the GM's overview or the settings, set by the entry file. */
let hooksToUi = {openOverview: () => {}, openSettings: () => {}};

/**
 * Connect the tour to the windows of the module.
 * @param {{openOverview: Function, openSettings: Function}} fns
 */
export function connect(fns) {
  hooksToUi = fns;
}

/* -------------------------------------------- */
/*  What exists right now                       */
/* -------------------------------------------- */

/**
 * The character of the player: the one the GM assigned, or any actor the player owns. For a GM in preview, an actor a
 * player owns.
 * @returns {Actor|null}
 */
export function myCharacter() {
  const user = game.user;
  if ( user.character ) return user.character;
  const owned = game.actors.filter(a => a.testUserPermission(user, "OWNER"));
  if ( !user.isGM ) return owned.find(a => a.type === "character") ?? owned[0] ?? null;
  return game.actors.find(a => a.hasPlayerOwner) ?? game.actors.contents[0] ?? null;
}

/** The tokens of the player on the viewed scene, the character's first. */
function ownTokens() {
  if ( !canvas?.ready ) return [];
  const character = myCharacter();
  const mine = canvas.tokens.placeables.filter(token => token.document.isOwner && token.visible);
  return mine.sort((a, b) => Number(b.actor?.id === character?.id) - Number(a.actor?.id === character?.id));
}

/** Another token the player can see and could target. */
function otherTokens() {
  if ( !canvas?.ready ) return [];
  const mine = new Set(ownTokens().map(token => token.id));
  return canvas.tokens.placeables.filter(token => token.visible && !mine.has(token.id));
}

/** The element of the player's open character sheet, or null. */
function sheetElement() {
  const sheet = myCharacter()?.sheet;
  return (sheet?.rendered && sheet.element) ? sheet.element : null;
}

/** The scene controls as data: {layer: {tools: {tool: {...}}}}, in both Foundry generations. */
function controlsData() {
  const controls = ui.controls?.controls;
  if ( !controls ) return {};
  return Array.isArray(controls) ? Object.fromEntries(controls.map(c => [c.name, c])) : controls;
}

/** Is a tool in the token controls, and visible to the player? */
function hasTool(name) {
  const tools = controlsData().tokens?.tools;
  const tool = Array.isArray(tools) ? tools.find(entry => entry.name === name) : tools?.[name];
  if ( tool ) return tool.visible !== false;
  return !!document.querySelector(`#scene-controls [data-tool='${name}']`);
}

/** Is an element in the page and not hidden? */
const shown = element => !!element && !element.hidden;

/**
 * What exists for the steps: what the player has (character, tokens, a fight), what the interface shows (sidebar tabs,
 * control layers, tools) and which game system runs. Steps wait for the first group and drop out when the second says
 * the player cannot use them.
 * @returns {Record<string, boolean>}
 */
export function context() {
  const ready = !!canvas?.ready && !!canvas.scene;
  const combat = game.combat;
  const ctx = {
    character: !!myCharacter(), ownToken: ownTokens().length > 0, otherToken: otherTokens().length > 0, canvas: ready,
    combat: !!combat, myCombatant: !!combat?.combatants?.some(c => c.isOwner),
    myTurn: !!combat?.started && !!combat.combatant?.isOwner, sheetOpen: !!sheetElement(),
    rollCard: !!document.querySelector("#chat .dice-roll, #chat-notifications .dice-roll"),
    "ui:rollmode": !!document.querySelector("#chat-controls [data-action='rollMode'], #chat-controls [data-action='messageMode']"),
    "ui:hotbar": shown(document.querySelector("#hotbar")), "ui:players": shown(document.querySelector("#players")),
    [`system:${game.system.id}`]: true
  };
  for ( const name of TABS ) ctx[`tab:${name}`] = shown(document.querySelector(`#sidebar-tabs [data-tab='${name}']`));
  for ( const name of ["tokens", "notes"] ) ctx[`control:${name}`] = shown(document.querySelector(`#scene-controls [data-control='${name}']`));
  ctx["control:shapes"] = ["templates", "regions"].some(name => shown(document.querySelector(`#scene-controls [data-control='${name}']`)));
  for ( const name of ["select", "target", "ruler", "sftHelp"] ) ctx[`tool:${name}`] = hasTool(name);
  return ctx;
}

/** The steps the GM offers. */
export function offered() {
  return offeredSteps(setting("steps"));
}

/** The chapters the GM offers. */
export function offeredChapterIds() {
  return offeredChapters(setting("chapters"));
}

/** The first chapter the GM offers. */
function firstChapter() {
  return offeredChapterIds()[0] ?? CHAPTER_IDS[0];
}

/**
 * The plan of a chapter for this player.
 * @param {string} [chapter]   The chapter, the running one by default
 */
function plan(chapter = state.chapter) {
  return planSteps({offered: offered(), progress: state.progress ?? progressOf(), ctx: context(), chapter});
}

/** The title of a chapter. */
const chapterTitle = id => t(`SFT.CHAPTERS.${id}.title`);

/* -------------------------------------------- */
/*  Timers                                      */
/* -------------------------------------------- */

function later(fn, ms) {
  const id = setTimeout(() => {
    state.timers.delete(id);
    fn();
  }, ms);
  state.timers.add(id);
  return id;
}

function clearTimers() {
  for ( const id of state.timers ) clearTimeout(id);
  state.timers.clear();
}

/* -------------------------------------------- */
/*  Where to look                               */
/* -------------------------------------------- */

/** The ring around a sidebar tab. */
const tabRect = name => rectOfSelector([`#sidebar-tabs [data-tab='${name}']`]);

/** The ring around something in the open sheet, or nothing while the sheet is closed. */
const inSheet = (...selectors) => {
  const element = sheetElement();
  return element ? rectOfSelector(selectors, element) : null;
};

/** Selectors for the tabs of a section of the sheet. */
const sheetTabSelectors = slot => SHEET_TABS[slot].flatMap(name => [`a[data-tab='${name}']`, `button[data-tab='${name}']`]);

/** What is shown for a part of the interface, or the tab it lives in while that tab is closed. */
const orTab = (tab, ...selectors) => () => rectOfSelector(selectors) ?? tabRect(tab);

/** The ring of each step: where on the screen the player should look. */
const RING = {
  sheet: () => rectOfToken(ownTokens()[0]) ?? rectOfSelector(["#sidebar-tabs [data-tab='actors']"]),
  moveKeys: () => rectOfToken(ownTokens()[0]),
  moveDrag: () => rectOfToken(ownTokens()[0]),
  target: () => rectOfToken(otherTokens()[0]),
  measure: () => rectOfSelector(["#scene-controls [data-tool='ruler']"]) ?? rectOfSelector(["#scene-controls [data-control='tokens']"]),
  chat: () => rectOfSelector(["#chat-message", "#chat-form", "#chat"]),
  whisper: () => rectOfSelector(["#chat-message", "#chat-form", "#chat"]),
  journal: () => tabRect("journal"),
  // The sidebar
  sbChat: () => tabRect("chat"),
  sbMode: orTab("chat", "#roll-privacy", "#message-modes", "#chat-controls"),
  sbCombat: () => tabRect("combat"),
  sbScenes: () => tabRect("scenes"),
  sbPlaceables: () => tabRect("placeables"),
  sbActors: () => tabRect("actors"),
  sbItems: () => tabRect("items"),
  sbJournal: () => tabRect("journal"),
  sbTables: () => tabRect("tables"),
  sbCards: () => tabRect("cards"),
  sbMacros: () => tabRect("macros"),
  sbPlaylists: () => tabRect("playlists"),
  sbVolume: orTab("playlists", "#playlists .global-volume", "#playlists [data-application-part='controls']"),
  sbCompendium: () => tabRect("compendium"),
  sbSettings: () => tabRect("settings"),
  sbConfigure: orTab("settings", "#settings [data-app='configure']"),
  sbControls: orTab("settings", "#settings [data-app='controls']"),
  // The scene controls
  scTokens: () => rectOfSelector(["#scene-controls [data-control='tokens']"]),
  scSelect: orControl("select"),
  scTarget: orControl("target"),
  scRuler: orControl("ruler"),
  scShapes: () => rectOfSelector(["#scene-controls [data-control='templates']", "#scene-controls [data-control='regions']"]),
  scNotes: () => rectOfSelector(["#scene-controls [data-control='notes']"]),
  scHelp: orControl("sftHelp"),
  scKeys: orTab("settings", "#settings [data-app='controls']"),
  // Your character sheet
  shOpen: () => rectOfToken(ownTokens()[0]) ?? rectOfSelector(["#sidebar-tabs [data-tab='actors']"]),
  shTabs: () => inSheet("nav.tabs a[data-tab]", "a[data-action='tab']", "a[data-tab]"),
  shAbilities: () => inSheet("[data-ability] a[data-action='roll'][data-type='ability']", "[data-ability] a[data-action='roll']"),
  shSkills: () => inSheet("li[data-key] a[data-action='roll'][data-type='skill']", "li[data-key] a[data-action='roll']"),
  shInventory: () => inSheet(...sheetTabSelectors("inventory")),
  shSpells: () => inSheet(...sheetTabSelectors("spells")),
  shFeatures: () => inSheet(...sheetTabSelectors("features")),
  shItem: () => inSheet("[data-item-id] a[data-action='edit']", "[data-item-id] .item-name", "[data-item-id]")
    ?? inSheet(...sheetTabSelectors("inventory")),
  shRest: () => inSheet("button[data-action='rest']", "[data-action='rest']"),
  // Chat and dice
  cdRoll: () => rectOfSelector(["#chat-message", "#chat-form", "#chat"]),
  cdInline: () => rectOfSelector(["#chat-message", "#chat-form", "#chat"]),
  cdOpen: () => {
    // Only the chat of the sidebar can be clicked, the floating copy of a message is not
    for ( const roll of [...document.querySelectorAll("#chat .dice-roll")].reverse() ) {
      const rect = rectOfElement(roll);
      if ( rect ) return rect;
    }
    return tabRect("chat");
  },
  cdPrivate: orTab("chat", "#roll-privacy", "#message-modes", "#chat-controls"),
  cdWhisper: () => rectOfSelector(["#chat-message", "#chat-form", "#chat"]),
  cdEmote: () => rectOfSelector(["#chat-message", "#chat-form", "#chat"]),
  // In a fight
  fiTracker: () => tabRect("combat"),
  fiInitiative: orTab("combat", "#combat .combatant [data-action='rollInitiative']", "#combat .combat-tracker"),
  fiTurn: orTab("combat", "#combat .combatant.active", "#combat .combat-tracker"),
  fiEnd: orTab("combat", "#combat [data-action='nextTurn']"),
  fiTarget: () => rectOfToken(otherTokens()[0]),
  fiHud: () => rectOfToken(ownTokens()[0]),
  fiConditions: () => rectOfSelector(["#token-hud [data-palette='effects']"]) ?? rectOfToken(ownTokens()[0]),
  fiElevation: () => rectOfSelector(["#token-hud input[name='elevation']"]) ?? rectOfToken(ownTokens()[0]),
  // Useful extras
  exHotbar: () => rectOfSelector(["#hotbar"]),
  exMacro: () => rectOfSelector(["#hotbar"]),
  exPlayers: () => rectOfSelector(["#players"]),
  exPause: () => rectOfSelector(["#pause"])
};

/** The ring around a tool of the controls, or around the layer while the tool is not shown. */
function orControl(tool) {
  return () => rectOfSelector([`#scene-controls [data-tool='${tool}']`, "#scene-controls [data-control='tokens']"]);
}

/** What "Show me" does before the ring: open what the step needs to be seen. */
const PREPARE = {
  roll: () => openSheet(),
  moveKeys: () => ownTokens()[0]?.control({releaseOthers: true}),
  sbMode: () => openTab("chat"),
  sbVolume: () => openTab("playlists"),
  sbConfigure: () => openTab("settings"),
  sbControls: () => openTab("settings"),
  scSelect: () => openControl("tokens"),
  scTarget: () => openControl("tokens"),
  scRuler: () => openControl("tokens"),
  scHelp: () => openControl("tokens"),
  scKeys: () => openTab("settings"),
  cdWhisper: () => openTab("chat"),
  cdPrivate: () => openTab("chat"),
  cdRoll: () => openTab("chat"),
  cdInline: () => openTab("chat"),
  cdEmote: () => openTab("chat"),
  cdOpen: () => openTab("chat"),
  fiInitiative: () => openTab("combat"),
  fiTurn: () => openTab("combat"),
  fiEnd: () => openTab("combat")
};

/** The steps of the first chapter whose ring appears by itself at the start of the step (as in version 1.0.0). */
const AUTO_PREPARE = new Set(["moveKeys"]);

/** Does a step have a "show me" action? */
function canShow(id) {
  return !!RING[id] || !!PREPARE[id] || !!STEP_DEFS[id].needs.includes("sheetOpen");
}

/** Open a sidebar tab for the player. */
function openTab(name) {
  try {
    ui.sidebar?.expand?.();
    ui.sidebar?.changeTab?.(name, "primary");
  } catch(err) {
    console.debug(`${MODULE_ID} | Could not open the tab ${name}`, err);
  }
}

/** Show a layer of the scene controls. */
function openControl(name) {
  try {
    ui.controls?.activate?.({control: name});
  } catch(err) {
    console.debug(`${MODULE_ID} | Could not open the controls ${name}`, err);
  }
}

/** Open the character sheet. */
function openSheet() {
  const actor = myCharacter();
  if ( actor && !actor.sheet.rendered ) actor.sheet.render({force: true});
}

/**
 * Show where a step wants the player to look: do what the step needs to be seen, then draw the ring.
 * @param {string} id
 * @param {object} [options]
 * @param {boolean} [options.prepare=true]   Open what the step needs (windows, tabs)
 */
function showStep(id, {prepare = true} = {}) {
  if ( prepare ) {
    PREPARE[id]?.();
    if ( STEP_DEFS[id].needs.includes("sheetOpen") ) openSheet();
  }
  const delay = (prepare && (PREPARE[id] || STEP_DEFS[id].needs.includes("sheetOpen"))) ? 450 : 0;
  const draw = () => {
    if ( state.step === id ) showRing(RING[id] ?? (() => null));
  };
  if ( delay ) later(draw, delay);
  else draw();
}

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

/** Does the open sheet lack the tab a step waits for? Such a step is skipped by itself. */
function sheetLacks(id) {
  const slot = STEP_DEFS[id].tabs;
  const element = sheetElement();
  if ( !slot || !element ) return false;
  return !element.querySelector(sheetTabSelectors(slot).join(", "));
}

/**
 * The card of a step.
 * @param {{id: string, missing: string[]}} step
 * @param {{total: number, done: number, skipped: number}} summary
 * @returns {object}
 */
function stepModel(step, summary, chapter = state.chapter, folded = state.folded) {
  const def = STEP_DEFS[step.id];
  const done = summary.done + summary.skipped;
  const missing = step.missing[0];
  const has = key => game.i18n.has(key);
  const buttons = [];
  if ( canShow(step.id) ) buttons.push({action: "show", label: t("SFT.card.show"), icon: "fa-solid fa-eye"});
  if ( def.look ) buttons.push({action: "seen", label: t("SFT.card.seen"), icon: "fa-solid fa-check"});
  buttons.push({action: "skip", label: t("SFT.card.skip"), icon: "fa-solid fa-forward-step"});
  return {
    mode: "step",
    icon: def.icon,
    kicker: t("SFT.card.kicker", {chapter: chapterTitle(chapter), n: Math.min(done + 1, summary.total), total: summary.total}),
    title: t(`SFT.STEPS.${step.id}.title`),
    text: t(doKey(step.id, game.system.id, has, game.release.generation, "text")),
    todo: t(doKey(step.id, game.system.id, has, game.release.generation)),
    note: missing ? t(`SFT.missing.${missing}`) : "",
    progress: {total: summary.total, done},
    buttons,
    link: {action: "stop", label: t("SFT.card.stop")},
    folded
  };
}

/** Show the card of the current step, or finish when there is none. */
function renderStep() {
  clearTimers();
  if ( !offeredChapterIds().includes(state.chapter) ) return stop();
  const list = plan();
  const next = currentStep(list);
  if ( !next ) return finish();
  // A step for a part the sheet does not have is not offered to this player
  if ( sheetLacks(next.id) && !next.missing.length ) {
    state.step = null;
    state.progress = markStep(state.progress, next.id, "skipped", Date.now());
    persist();
    trace.add("stepAutoSkipped", {step: next.id});
    return renderStep();
  }
  const summary = counts(list);
  // The ring is drawn again when the step changes and when a waiting step becomes possible
  const ringKey = `${next.id}|${next.missing.length ? "wait" : "go"}|${state.folded ? "folded" : "open"}`;
  const changed = state.ringKey !== ringKey;
  state.ringKey = ringKey;
  state.step = next.id;
  state.view = "step";
  state.missing = next.missing.join();
  listenFor(eventOf(next.id));
  showCard(stepModel(next, summary));
  if ( changed ) {
    hideRing();
    if ( !state.folded && !next.missing.length ) {
      if ( state.chapter === "basics" ) {
        // The first chapter shows the ring by itself, as it always did, except where it would open a window
        if ( next.id !== "roll" ) showStep(next.id, {prepare: AUTO_PREPARE.has(next.id)});
      }
      else showStep(next.id, {prepare: false});
    }
  }
}

/** The chapter after this one that the player has not finished, or null. */
function nextChapter(after) {
  const finished = (state.progress ?? progressOf()).chapters;
  const open = offeredChapterIds().filter(id => (id !== after) && !finished.includes(id));
  const index = CHAPTER_IDS.indexOf(after);
  return open.find(id => CHAPTER_IDS.indexOf(id) > index) ?? open[0] ?? null;
}

/** The card after the last step of a chapter. */
function finish() {
  state.step = null;
  state.ringKey = "";
  state.view = "done";
  listenFor(null);
  hideRing();
  const chapter = state.chapter;
  const p = finishProgress(state.progress, Date.now(), chapter);
  state.progress = p;
  persist();
  trace.add("finished", {chapter, preview: state.preview});
  showCard(doneModel(chapter, nextChapter(chapter)));
  later(() => {
    if ( !state.step && (state.view === "done") ) hideCard();
  }, DONE_MS);
}

/**
 * The card after the last step of a chapter.
 * @param {string} chapter
 * @param {string|null} next   The chapter offered next, if any
 * @returns {object}
 */
function doneModel(chapter, next) {
  const buttons = [];
  if ( next ) buttons.push({action: `chapter:${next}`, label: t("SFT.done.next", {chapter: chapterTitle(next)}), primary: true,
    icon: "fa-solid fa-play"});
  buttons.push({action: "menu", label: t("SFT.done.pick"), icon: "fa-solid fa-list"});
  buttons.push({action: "close", label: t("SFT.card.close"), primary: !next});
  return {mode: "done", icon: "fa-solid fa-flag-checkered", kicker: t("SFT.done.kicker"),
    title: (chapter === CHAPTER_IDS[0]) ? t("SFT.done.title") : t("SFT.done.chapterTitle", {chapter: chapterTitle(chapter)}),
    text: t(next ? "SFT.done.more" : "SFT.done.all"), buttons, link: {action: "again", label: t("SFT.card.again")}};
}

/** Store the progress, unless a GM is only looking at the tour. */
function persist() {
  if ( state.preview ) return;
  saveProgress(state.progress);
}

/* -------------------------------------------- */
/*  Offer, start, stop                          */
/* -------------------------------------------- */

/**
 * Offer the tour: a small card with three answers.
 * @param {"offer"|"invited"} kind
 */
function showOffer(kind) {
  state.step = null;
  state.view = kind;
  listenFor(null);
  const chapter = (kind === "invited") ? inviteChapterOf() : firstChapter();
  showCard(offerModel(kind, game.user.name, chapter));
  trace.add("offered", {kind, chapter});
}

/**
 * The card that offers the tour.
 * @param {"offer"|"invited"} kind
 * @param {string} name      The player's name
 * @param {string} chapter   The chapter the offer names
 * @returns {object}
 */
function offerModel(kind, name, chapter) {
  const named = (kind === "invited") && (chapter !== CHAPTER_IDS[0]);
  return {
    mode: kind,
    icon: named ? CHAPTERS.find(c => c.id === chapter).icon : "fa-solid fa-compass",
    kicker: t("SFT.offer.kicker"),
    title: t("SFT.offer.title", {name}),
    text: named ? t("SFT.offer.invitedChapter", {chapter: chapterTitle(chapter)})
      : t(kind === "invited" ? "SFT.offer.invited" : "SFT.offer.text"),
    buttons: [
      {action: "start", label: t("SFT.offer.start"), primary: true, icon: "fa-solid fa-play"},
      {action: "later", label: t("SFT.offer.later")}
    ],
    link: {action: "known", label: t("SFT.offer.known")}
  };
}

/** The menu card the help button opens when no step is on the card: a list of the chapters. */
function showMenu() {
  // A step that was on the card is paused: Close brings it back, picking a chapter leaves it half done
  state.paused = !!state.step || (state.paused && (state.view === "menu"));
  state.step = null;
  state.ringKey = "";
  state.view = "menu";
  listenFor(null);
  hideRing();
  showCard(menuModel(state.progress ?? progressOf()));
}

/**
 * The card with the list of chapters.
 * @param {object} p   The player's progress
 * @returns {object}
 */
function menuModel(p) {
  const ids = offeredChapterIds();
  const ctx = permissiveContext(game.system.id);
  const list = ids.map(id => {
    const summary = chapterSummary(p, id, {offered: offered(), ctx});
    let meta = t("SFT.menu.new");
    if ( summary.finished ) meta = t("SFT.menu.chapterDone");
    else if ( summary.state === "part" ) meta = t("SFT.menu.chapterPart", {done: summary.done + summary.skipped, total: summary.total});
    return {action: `chapter:${id}`, icon: CHAPTERS.find(c => c.id === id).icon, label: chapterTitle(id), meta,
      redo: (summary.state === "part") ? {action: `restart:${id}`, label: t("SFT.menu.restart")} : null,
      state: summary.state, primary: (p.chapter === id) && (p.status === STATUS.RUNNING || p.status === STATUS.STOPPED)};
  });
  let text = t("SFT.menu.intro");
  if ( p.status === STATUS.EXPERIENCED ) text = t("SFT.menu.experienced");
  return {mode: "menu", icon: "fa-solid fa-compass", kicker: t("SFT.menu.kicker"), title: t("SFT.menu.title"), text,
    list, buttons: [], link: {action: "close", label: t("SFT.card.close")}};
}

/**
 * Start a chapter, or go on where it stopped.
 * @param {object} [options]
 * @param {string} [options.chapter]          The chapter, the last one used or the first by default
 * @param {boolean} [options.restart=false]   Begin the chapter again from its first step
 * @param {boolean} [options.preview=false]   A GM looks at it, nothing is stored
 */
export function start({chapter, restart = false, preview = false} = {}) {
  clearTimers();
  state.preview = preview;
  state.folded = false;
  const prev = preview ? {} : (state.progress ?? progressOf());
  const id = CHAPTER_IDS.includes(chapter) ? chapter : (prev.chapter || state.chapter || firstChapter());
  state.chapter = id;
  state.paused = false;
  state.progress = startProgress(prev, Date.now(), {restart, chapter: id, all: preview});
  state.step = null;
  state.ringKey = "";
  persist();
  trace.add("started", {restart, preview, chapter: id});
  renderStep();
}

/**
 * The player picks a chapter from the menu: a finished chapter starts again, an unfinished one goes on.
 * @param {string} id
 */
function startChapter(id) {
  const p = state.progress ?? progressOf();
  const summary = chapterSummary(p, id, {offered: offered(), ctx: permissiveContext(game.system.id)});
  start({chapter: id, restart: summary.finished, preview: state.preview && game.user.isGM});
}

/** Stop the tour. The steps done so far are kept. */
export function stop() {
  clearTimers();
  listenFor(null);
  hideRing();
  hideCard();
  state.step = null;
  state.view = "";
  state.ringKey = "";
  if ( state.progress && !state.preview ) {
    state.progress = stopProgress(state.progress, Date.now());
    persist();
  }
  trace.add("stopped", {preview: state.preview});
  state.preview = false;
}

/** The player opens the tour from the help button, the settings or the macro API. A GM sees a preview. */
export function help() {
  // The step about the help button is done by this click, its card stays until the click is recognized
  if ( state.step && completes(state.step, "tool:sftHelp") ) return;
  state.folded = false;
  state.preview = game.user.isGM;
  state.progress = game.user.isGM ? {} : (state.progress ?? progressOf());
  showMenu();
}

/** Is a step on the card? */
export function isRunning() {
  return !!state.step;
}

/** The step on the card, or null. */
export function currentStepId() {
  return state.step;
}

/** The chapter that is running or was picked last, or an empty string. */
export function currentChapter() {
  return state.chapter;
}

/** What the tour knows about this client, for the debug file and the self test. */
export function describe() {
  return {running: !!state.step, step: state.step, chapter: state.chapter, view: state.view, preview: state.preview,
    folded: state.folded, card: isShown(), progress: state.progress ?? progressOf()};
}

/* -------------------------------------------- */
/*  Tips                                        */
/* -------------------------------------------- */

/**
 * A moment of a fight that deserves a tip: show it on the card, once, and only when nothing else is on the card.
 * @param {"combatStart"|"myTurn"} tip
 */
function maybeTip(tip) {
  if ( !state.started || game.user.isGM ) return;
  const progress = progressOf();
  const due = tipDue({tip, progress, mode: setting("offer"), isGM: game.user.isGM, enabled: setting("tips"),
    chapters: offeredChapterIds(), offered: offered()});
  if ( !due ) return;
  // A card on the screen is never replaced, except by one of its own kind
  if ( isShown() && !["done", "menu"].includes(shownMode()) ) return;
  state.progress = tipShownProgress(progress, tip, Date.now());
  state.preview = false;
  persist();
  showTip(tip);
  trace.add("tip", {tip});
}

/**
 * The card of a tip.
 * @param {string} tip
 * @returns {object}
 */
function tipModel(tip) {
  return {mode: "tip", icon: "fa-solid fa-swords", kicker: t("SFT.tip.kicker"), title: t(`SFT.TIPS.${tip}.title`),
    text: t(`SFT.TIPS.${tip}.text`), buttons: [
      {action: "tipStart", label: t("SFT.tip.start"), primary: true, icon: "fa-solid fa-play"},
      {action: "tipLater", label: t("SFT.tip.later")}
    ], link: {action: "tipOff", label: t("SFT.tip.off")}};
}

/**
 * Draw the card of a tip.
 * @param {string} tip
 */
function showTip(tip) {
  clearTimers();
  state.step = null;
  state.view = "tip";
  state.tip = tip;
  listenFor(null);
  hideRing();
  showCard(tipModel(tip));
  later(() => {
    if ( state.view === "tip" ) {
      state.view = "";
      hideCard();
    }
  }, TIP_MS);
}

/* -------------------------------------------- */
/*  Reacting to the player                      */
/* -------------------------------------------- */

/**
 * The player did something the tour watches for.
 * @param {string} event
 */
function onEvent(event) {
  if ( !state.step || !completes(state.step, event) ) return;
  complete(state.step);
}

/**
 * A step is done.
 * @param {string} id
 */
function complete(id) {
  state.step = null;
  listenFor(null);
  hideRing();
  state.progress = markStep(state.progress, id, "done", Date.now());
  persist();
  trace.add("stepDone", {step: id});
  if ( state.folded ) return renderStep();
  const list = plan();
  const c = counts(list);
  showCard(flashModel(id, c, state.chapter));
  later(renderStep, FLASH_MS);
}

/**
 * The short card after a step is done.
 * @param {string} id
 * @param {{total: number, done: number, skipped: number}} c
 * @param {string} chapter
 * @returns {object}
 */
function flashModel(id, c, chapter) {
  return {mode: "flash", icon: "fa-solid fa-circle-check", kicker: t("SFT.card.kicker", {chapter: chapterTitle(chapter),
    n: Math.min(c.done + c.skipped, c.total), total: c.total}), title: t(doneKey(id, key => game.i18n.has(key))),
  progress: {total: c.total, done: c.done + c.skipped}};
}

/** Skip the current step. */
function skip() {
  const id = state.step;
  if ( !id ) return;
  state.step = null;
  state.progress = markStep(state.progress, id, "skipped", Date.now());
  persist();
  trace.add("stepSkipped", {step: id});
  renderStep();
}

/**
 * The card's buttons.
 * @param {string} action
 * @param {object} [event]
 */
function onCardAction(action, event) {
  if ( action.startsWith("chapter:") ) return startChapter(action.slice(8));
  if ( action.startsWith("restart:") ) {
    return start({chapter: action.slice(8), restart: true, preview: state.preview && game.user.isGM});
  }
  switch ( action ) {
    case "start": {
      const invite = inviteOf();
      const chapter = (state.view === "invited") ? inviteChapterOf() : firstChapter();
      state.progress = {...(state.progress ?? progressOf()), handledInvite: invite};
      start({restart: true, chapter});
      break;
    }
    case "later": {
      state.progress = {...laterProgress(state.progress ?? progressOf(), Date.now()), handledInvite: inviteOf()};
      persist();
      trace.add("later", {});
      state.view = "";
      hideCard();
      break;
    }
    case "known": {
      state.progress = {...experiencedProgress(state.progress ?? progressOf(), Date.now()), handledInvite: inviteOf()};
      persist();
      trace.add("experienced", {});
      state.view = "";
      hideCard();
      break;
    }
    case "again": start({restart: true, chapter: state.chapter, preview: state.preview && game.user.isGM}); break;
    case "menu": showMenu(); break;
    case "close":
      if ( state.paused && state.chapter && !state.preview && (state.view === "menu") ) {
        state.paused = false;
        renderStep();
        break;
      }
      state.paused = false;
      state.view = "";
      hideCard();
      break;
    case "show": if ( state.step ) showStep(state.step); break;
    case "seen": if ( state.step ) complete(state.step); break;
    case "skip": skip(); break;
    case "stop": stop(); break;
    case "fold":
      state.folded = true;
      renderStep();
      break;
    case "unfold":
      state.folded = false;
      renderStep();
      break;
    case "tipStart":
      state.view = "";
      start({chapter: "fight", restart: false});
      break;
    case "tipLater":
      state.view = "";
      hideCard();
      break;
    case "tipOff":
      state.view = "";
      hideCard();
      game.settings.set(MODULE_ID, "tips", false);
      break;
    case "gear": hooksToUi.openSettings(); break;
    case "moved": {
      const place = event?.place ?? currentPlace();
      if ( place ) game.settings.set(MODULE_ID, "cardPlace", place);
      break;
    }
    default: break;
  }
}

/** Is a combat running? The tour stays out of the way then, except for the chapter about fights. */
function inCombat() {
  return !!game.combat?.started;
}

/**
 * Decide what to show now, from the stored progress.
 * @param {object} [options]
 * @param {boolean} [options.soon=false]   Show an offer without the usual wait
 */
function consider({soon = false} = {}) {
  if ( state.step || isShown() ) return;
  state.progress = progressOf();
  if ( !offeredChapterIds().length ) return;
  const kind = offerKind({progress: state.progress, mode: setting("offer"), isGM: game.user.isGM, invite: inviteOf()});
  if ( !kind ) return;
  if ( kind === "resume" ) {
    state.chapter = offeredChapterIds().includes(state.progress.chapter) ? state.progress.chapter : firstChapter();
    state.folded = inCombat() && (state.chapter !== "fight");
    state.preview = false;
    later(() => {
      if ( !state.step && !isShown() ) renderStep();
    }, 1200);
    return;
  }
  const show = () => {
    if ( state.step || isShown() ) return;
    // No new card in the middle of a fight, try again in a minute
    if ( inCombat() ) return later(show, 60000);
    // What was stored may have changed while the offer waited
    state.progress = progressOf();
    const now = offerKind({progress: state.progress, mode: setting("offer"), isGM: game.user.isGM, invite: inviteOf()});
    if ( (now === "offer") || (now === "invited") ) showOffer(now);
  };
  later(show, soon ? 800 : OFFER_DELAY);
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/** Look at the card again after the scene, the tokens, a fight or a window changed, so a waiting note appears or goes away. */
let refreshTimer = null;
function refreshSoon() {
  if ( !state.step || refreshTimer ) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if ( !state.step ) return;
    const next = currentStep(plan());
    if ( !next || (next.id !== state.step) || (next.missing.join() !== state.missing) ) renderStep();
  }, 400);
}

/**
 * Start the tour's part in the page. Call in "ready".
 */
export function startTour() {
  if ( state.started ) return;
  state.started = true;
  onAction(onCardAction);
  setPlace(setting("cardPlace"));
  registerDetection({
    emit: onEvent,
    wanted: prefix => !!state.step && wantsEvent(state.step, prefix)
  });
  for ( const name of ["canvasReady", "createToken", "deleteToken", "controlToken", "createCombat", "deleteCombat",
    "updateCombat", "createCombatant", "deleteCombatant", "updateCombatant", "createChatMessage", "renderApplicationV2",
    "closeApplicationV2", "renderApplication", "closeApplication"] ) Hooks.on(name, refreshSoon);
  window.addEventListener("resize", keepOnScreen);
  Hooks.on("updateUser", (user, changes, options, userId) => {
    if ( (user.id !== game.user.id) || (userId === game.user.id) ) return;
    if ( !touchesFlags(changes) ) return;
    onStoredChange();
  });
  // Tips at the right moment of a fight
  // The hook "combatStart" runs only at the GM who starts the fight, every client sees the update of the round
  Hooks.on("updateCombat", (combat, changes) => {
    if ( (changes.round === 1) && combat.started && combat.combatants?.some(c => c.isOwner) ) {
      setTimeout(() => maybeTip("combatStart"), 800);
    }
  });
  Hooks.on("combatTurnChange", (combat, prior, current) => {
    if ( combat.combatants?.get(current?.combatantId)?.isOwner ) setTimeout(() => maybeTip("myTurn"), 800);
  });
  consider();
}

/** The GM changed what is stored for this player. */
function onStoredChange() {
  const p = progressOf();
  if ( state.step && (p.status !== STATUS.RUNNING) ) {
    // The GM reset the player or marked them as experienced: put the card away
    clearTimers();
    listenFor(null);
    hideRing();
    hideCard();
    state.step = null;
    state.view = "";
  }
  state.progress = p;
  consider({soon: true});
}

/** The module language or the look changed: draw the open card again. */
export function redraw() {
  if ( !isShown() ) return;
  if ( state.view === "step" ) renderStep();
  else if ( (state.view === "offer") || (state.view === "invited") ) showOffer(state.view);
  else if ( state.view === "menu" ) showMenu();
  else if ( state.view === "tip" ) showTip(state.tip);
  else if ( state.view === "done" ) hideCard();
}

/** The cards as data, for the sample windows (building one shows or stores nothing). */
export const cardModels = {step: stepModel, flash: flashModel, done: doneModel, offer: offerModel, menu: menuModel, tip: tipModel};

export const __test__ = {OFFER_DELAY, FLASH_MS, TIP_MS};
