/**
 * The tour of one player: offers it, runs the steps, waits for what the player does, stores the progress and counts
 * for the GM. The card is small, folds to a pill, and every step can be skipped, so the tour never takes over a game.
 */

import {MODULE_ID, setting, t} from "./config.mjs";
import {currentPlace, hideCard, hideRing, isShown, keepOnScreen, onAction, rectOfSelector, rectOfToken, setPlace, showCard,
  showRing} from "./card.mjs";
import {eventOf, listenFor, registerDetection} from "./detect.mjs";
import {inviteOf, progressOf, saveProgress, touchesFlags} from "./progress.mjs";
import {STATUS, completes, counts, currentStep, doKey, experiencedProgress, finishProgress, laterProgress, markStep,
  offerKind, offeredSteps, planSteps, startProgress, stopProgress, STEP_DEFS} from "./tour-logic.mjs";
import {trace} from "./trace.mjs";

/** Wait before a card appears on its own after the world is ready, in ms. */
const OFFER_DELAY = 6000;

/** How long the "done" check stays before the next step, in ms. */
const FLASH_MS = 1300;

/** The finish card goes away by itself after this many ms. */
const DONE_MS = 30000;

/** The state of the tour on this client. */
const state = {
  /** The tour runs in preview: a GM looks at it, nothing is stored. */
  preview: false,
  /** The progress as this client knows it. */
  progress: null,
  /** The step on the card now, or null. */
  step: null,
  /** What the card shows: "step", "offer", "invited", "menu", "done" or "" for nothing. */
  view: "",
  /** What the current step waits for before it can be done, for the check after a scene change. */
  missing: "",
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

/**
 * What exists for the steps.
 * @returns {{character: boolean, ownToken: boolean, otherToken: boolean, canvas: boolean}}
 */
export function context() {
  const ready = !!canvas?.ready && !!canvas.scene;
  return {character: !!myCharacter(), ownToken: ownTokens().length > 0, otherToken: otherTokens().length > 0,
    canvas: ready};
}

/** The steps the GM offers. */
export function offered() {
  return offeredSteps(setting("steps"));
}

/** The plan of this player's tour. */
function plan() {
  return planSteps({offered: offered(), progress: state.progress ?? progressOf(), ctx: context()});
}

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
/*  Cards                                       */
/* -------------------------------------------- */

/** Does a step have a "show me" action? */
const SHOW = {
  sheet: () => ringOn(() => rectOfToken(ownTokens()[0]) ?? rectOfSelector(["#sidebar-tabs [data-tab='actors']"])),
  roll: () => openSheet(),
  moveKeys: () => {
    ownTokens()[0]?.control({releaseOthers: true});
    ringOn(() => rectOfToken(ownTokens()[0]));
  },
  moveDrag: () => ringOn(() => rectOfToken(ownTokens()[0])),
  target: () => ringOn(() => rectOfToken(otherTokens()[0])),
  measure: () => ringOn(() => rectOfSelector(["#scene-controls [data-tool='ruler']", "[data-tool='ruler']"])),
  chat: () => ringOn(() => rectOfSelector(["#chat-message", "#chat-form", "#chat"])),
  whisper: () => ringOn(() => rectOfSelector(["#chat-message", "#chat-form", "#chat"])),
  journal: () => ringOn(() => rectOfSelector(["#sidebar-tabs [data-tab='journal']", "[data-tab='journal']"]))
};

function ringOn(getRect) {
  showRing(getRect);
}

/** Open the character sheet for the roll step. */
function openSheet() {
  const actor = myCharacter();
  if ( actor ) actor.sheet.render({force: true});
}

/**
 * The card of a step.
 * @param {{id: string, missing: string[]}} step
 * @param {{total: number, done: number, skipped: number}} summary
 * @returns {object}
 */
function stepModel(step, summary) {
  const done = summary.done + summary.skipped;
  const missing = step.missing[0];
  const buttons = [];
  if ( SHOW[step.id] ) buttons.push({action: "show", label: t("SFT.card.show"), icon: "fa-solid fa-eye"});
  buttons.push({action: "skip", label: t("SFT.card.skip"), icon: "fa-solid fa-forward-step"});
  return {
    mode: "step",
    icon: STEP_DEFS[step.id].icon,
    kicker: t("SFT.card.kicker", {n: Math.min(done + 1, summary.total), total: summary.total}),
    title: t(`SFT.STEPS.${step.id}.title`),
    text: t(`SFT.STEPS.${step.id}.text`),
    todo: t(doKey(step.id, game.system.id, key => game.i18n.has(key), game.release.generation)),
    note: missing ? t(`SFT.missing.${missing}`) : "",
    progress: {total: summary.total, done},
    buttons,
    link: {action: "stop", label: t("SFT.card.stop")},
    folded: state.folded
  };
}

/** Show the card of the current step, or finish when there is none. */
function renderStep() {
  clearTimers();
  const list = plan();
  const next = currentStep(list);
  if ( !next ) return finish();
  const summary = counts(list);
  const changed = state.step !== next.id;
  state.step = next.id;
  state.view = "step";
  state.missing = next.missing.join();
  listenFor(eventOf(next.id));
  showCard(stepModel(next, summary));
  if ( changed ) {
    hideRing();
    if ( !state.folded && SHOW[next.id] && (next.id !== "roll") && !next.missing.length ) SHOW[next.id]();
  }
}

/** The card after the last step. */
function finish() {
  state.step = null;
  state.view = "done";
  listenFor(null);
  hideRing();
  const p = finishProgress(state.progress, Date.now());
  state.progress = p;
  persist();
  trace.add("finished", {preview: state.preview});
  showCard({mode: "done", icon: "fa-solid fa-flag-checkered", kicker: t("SFT.done.kicker"), title: t("SFT.done.title"),
    text: t("SFT.done.text"), buttons: [{action: "close", label: t("SFT.card.close"), primary: true}],
    link: {action: "again", label: t("SFT.card.again")}});
  later(() => {
    if ( !state.step ) hideCard();
  }, DONE_MS);
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
  const name = game.user.name;
  showCard({
    mode: kind,
    icon: "fa-solid fa-compass",
    kicker: t("SFT.offer.kicker"),
    title: t("SFT.offer.title", {name}),
    text: t(kind === "invited" ? "SFT.offer.invited" : "SFT.offer.text"),
    buttons: [
      {action: "start", label: t("SFT.offer.start"), primary: true, icon: "fa-solid fa-play"},
      {action: "later", label: t("SFT.offer.later")}
    ],
    link: {action: "known", label: t("SFT.offer.known")}
  });
  trace.add("offered", {kind});
}

/** The menu card the help button opens when the tour is not running. */
function showMenu() {
  state.step = null;
  state.view = "menu";
  listenFor(null);
  const p = state.progress ?? progressOf();
  const list = plan();
  const c = counts(list);
  const buttons = [];
  let text = t("SFT.menu.new");
  if ( p.status === STATUS.FINISHED ) text = t("SFT.menu.finished");
  else if ( p.status === STATUS.EXPERIENCED ) text = t("SFT.menu.experienced");
  else if ( (c.done + c.skipped > 0) && (c.left > 0) ) text = t("SFT.menu.stopped", {done: c.done + c.skipped, total: c.total});
  const partial = (c.done + c.skipped > 0) && (c.left > 0) && (p.status !== STATUS.FINISHED);
  if ( partial ) {
    buttons.push({action: "continue", label: t("SFT.menu.continue"), primary: true, icon: "fa-solid fa-play"});
    buttons.push({action: "again", label: t("SFT.menu.again"), icon: "fa-solid fa-rotate-left"});
  }
  else buttons.push({action: "again", label: t("SFT.menu.start"), primary: true, icon: "fa-solid fa-play"});
  showCard({mode: "menu", icon: "fa-solid fa-compass", kicker: t("SFT.menu.kicker"), title: t("SFT.menu.title"), text,
    buttons, link: {action: "close", label: t("SFT.card.close")}});
}

/**
 * Start the tour, or go on where it stopped.
 * @param {object} [options]
 * @param {boolean} [options.restart=false]   Begin again from the first step
 * @param {boolean} [options.preview=false]   A GM looks at it, nothing is stored
 */
export function start({restart = false, preview = false} = {}) {
  clearTimers();
  state.preview = preview;
  state.folded = false;
  const prev = preview ? {} : (state.progress ?? progressOf());
  state.progress = startProgress(prev, Date.now(), {restart: restart || preview});
  state.step = null;
  persist();
  trace.add("started", {restart, preview});
  renderStep();
}

/** Stop the tour. The steps done so far are kept. */
export function stop() {
  clearTimers();
  listenFor(null);
  hideRing();
  hideCard();
  state.step = null;
  state.view = "";
  if ( state.progress && !state.preview ) {
    state.progress = stopProgress(state.progress, Date.now());
    persist();
  }
  trace.add("stopped", {preview: state.preview});
  state.preview = false;
}

/** The player opens the tour from the help button, the settings or the macro API. */
export function help() {
  if ( game.user.isGM && !state.step ) return start({preview: true});
  if ( state.step ) {
    state.folded = false;
    renderStep();
    return;
  }
  state.progress ??= progressOf();
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

/** What the tour knows about this client, for the debug file and the self test. */
export function describe() {
  return {running: !!state.step, step: state.step, preview: state.preview, folded: state.folded, card: isShown(),
    progress: state.progress ?? progressOf()};
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
  showCard({mode: "flash", icon: "fa-solid fa-circle-check", kicker: t("SFT.card.kicker", {n: Math.min(c.done + c.skipped, c.total),
    total: c.total}), title: t(`SFT.STEPS.${id}.done`), progress: {total: c.total, done: c.done + c.skipped}});
  later(renderStep, FLASH_MS);
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
  switch ( action ) {
    case "start": {
      const invite = inviteOf();
      state.progress = {...(state.progress ?? progressOf()), handledInvite: invite};
      start({restart: true});
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
    case "again": start({restart: true, preview: state.preview && game.user.isGM}); break;
    case "continue": start(); break;
    case "close":
      state.view = "";
      hideCard();
      break;
    case "show": SHOW[state.step]?.(); break;
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
    case "gear": hooksToUi.openSettings(); break;
    case "moved": {
      const place = event?.place ?? currentPlace();
      if ( place ) game.settings.set(MODULE_ID, "cardPlace", place);
      break;
    }
    default: break;
  }
}

/** Is a combat running? The tour stays out of the way then. */
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
  const kind = offerKind({progress: state.progress, mode: setting("offer"), isGM: game.user.isGM, invite: inviteOf()});
  if ( !kind ) return;
  if ( kind === "resume" ) {
    state.folded = inCombat();
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
    showOffer(kind);
  };
  later(show, soon ? 800 : OFFER_DELAY);
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/** Look at the card again after the scene or the tokens changed, so a waiting note appears or goes away. */
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
    wanted: prefix => !!state.step && ((eventOf(state.step) === prefix) || eventOf(state.step)?.startsWith(`${prefix}:`))
  });
  for ( const name of ["canvasReady", "createToken", "deleteToken", "controlToken"] ) Hooks.on(name, refreshSoon);
  window.addEventListener("resize", keepOnScreen);
  Hooks.on("updateUser", (user, changes, options, userId) => {
    if ( (user.id !== game.user.id) || (userId === game.user.id) ) return;
    if ( !touchesFlags(changes) ) return;
    onStoredChange();
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
  else if ( state.view === "done" ) hideCard();
}

export const __test__ = {OFFER_DELAY, FLASH_MS};
