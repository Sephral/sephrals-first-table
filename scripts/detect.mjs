/**
 * Detecting what the player does. The tour never watches a player who is not on a step: the listeners that cost
 * something (keys, pointer, the measuring poll) run only while the tour is on a step that needs them.
 *
 * Every detection calls emit(event) with one of: "sheet", "roll", "move:keys", "move:drag", "target", "ping",
 * "measure", "chat", "whisper", "journal". What an event completes is decided in tour-logic.mjs.
 */

import {MODULE_ID} from "./config.mjs";
import {DEFAULT_MOVE_CODES, STEP_DEFS, chatEvents, classifyMove, isMeasuring, isOwnPing} from "./tour-logic.mjs";

/** How often the ruler is looked at while the measuring step is on, in ms. */
const MEASURE_POLL = 300;

/** The state of the listeners. */
const state = {
  emit: () => {},
  wanted: () => false,
  lastKeyAt: 0,
  lastPointerAt: 0,
  pointerDownAt: 0,
  keyDown: new Set(),
  moveCodes: new Set(DEFAULT_MOVE_CODES),
  listening: false,
  poll: null,
  pings: null
};

/**
 * The key codes that move a token: the defaults and what the player bound to the movement actions.
 * @returns {Set<string>}
 */
function movementCodes() {
  const codes = new Set(DEFAULT_MOVE_CODES);
  try {
    for ( const [name, bindings] of game.keybindings.bindings ?? [] ) {
      if ( !/^core\.(move|pan)/.test(name) ) continue;
      for ( const binding of bindings ) if ( binding?.key ) codes.add(binding.key);
    }
  } catch(err) {
    console.debug(`${MODULE_ID} | Could not read the movement keys`, err);
  }
  return codes;
}

/** Is this event on the canvas element? */
function onCanvas(event) {
  const board = globalThis.canvas?.app?.view;
  return !!board && (event.target === board);
}

function onKeyDown(event) {
  if ( !state.moveCodes.has(event.code) ) return;
  state.lastKeyAt = Date.now();
  state.keyDown.add(event.code);
}

function onKeyUp(event) {
  state.keyDown.delete(event.code);
}

function onPointerDown(event) {
  if ( !onCanvas(event) ) return;
  state.lastPointerAt = Date.now();
  state.pointerDownAt = Date.now();
}

function onPointerUp(event) {
  if ( onCanvas(event) ) state.lastPointerAt = Date.now();
}

/** A click on the journal tab when it is already the open tab does not change the tab, so it is read here. */
function onClick(event) {
  const tab = event.target?.closest?.("#sidebar-tabs [data-tab='journal'], #sidebar [data-tab='journal']");
  if ( tab && state.wanted("journal") ) state.emit("journal");
}

/**
 * Start or stop the listeners that cost something, depending on what the current step needs.
 * @param {string|null} event   The event the current step waits for, or null when no step is on
 */
export function listenFor(event) {
  const needsMove = event?.startsWith("move:");
  const needsPing = (event === "ping");
  const needsPointer = needsMove || needsPing;
  if ( needsPointer && !state.listening ) {
    state.moveCodes = movementCodes();
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    state.listening = true;
  }
  else if ( !needsPointer && state.listening ) {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keyup", onKeyUp, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    state.listening = false;
    state.keyDown.clear();
  }
  if ( (event === "measure") && !state.poll ) state.poll = setInterval(pollRuler, MEASURE_POLL);
  else if ( (event !== "measure") && state.poll ) {
    clearInterval(state.poll);
    state.poll = null;
  }
}

/** Look at the player's ruler. */
function pollRuler() {
  if ( document.hidden || !globalThis.canvas?.ready ) return;
  const ruler = canvas.controls?.ruler;
  if ( ruler?.active && isMeasuring(ruler.path ?? ruler.waypoints) ) state.emit("measure");
}

/** The pings of the map: the player's own ping is the one drawn while their pointer is down on the canvas. */
function watchPings() {
  const container = canvas.controls?.pings;
  if ( !container || (state.pings === container) ) return;
  state.pings = container;
  container.on("childAdded", () => {
    if ( !state.wanted("ping") ) return;
    if ( isOwnPing({now: Date.now(), pointerDownAt: state.pointerDownAt}) ) state.emit("ping");
  });
}

/** The document an application shows, when it is a document sheet. */
function documentOf(app) {
  return app?.document ?? app?.object ?? null;
}

/**
 * A window was drawn: the player's character sheet or a journal.
 * @param {Application|ApplicationV2} app
 */
function onRenderApp(app) {
  const doc = documentOf(app);
  if ( !doc ) return;
  if ( (doc.documentName === "Actor") && doc.isOwner && state.wanted("sheet") ) state.emit("sheet");
  else if ( ((doc.documentName === "JournalEntry") || (doc.documentName === "JournalEntryPage")) && state.wanted("journal") ) {
    state.emit("journal");
  }
}

/**
 * Register the hooks. Call once, in "ready".
 * @param {object} handlers
 * @param {(event: string) => void} handlers.emit        Receives every detected event
 * @param {(event: string) => boolean} handlers.wanted   Is a step waiting for this event right now?
 */
export function registerDetection({emit, wanted}) {
  state.emit = emit;
  state.wanted = wanted;
  document.addEventListener("click", onClick, true);

  // Windows: Foundry 13 and 14 call a hook per class in the window's chain, and older sheets use the other name
  Hooks.on("renderApplicationV2", onRenderApp);
  Hooks.on("renderApplication", onRenderApp);
  Hooks.on("changeSidebarTab", app => {
    const name = app?.constructor?.tabName ?? app?.tabName ?? app?.options?.id;
    if ( (name === "journal") && state.wanted("journal") ) state.emit("journal");
  });

  Hooks.on("createChatMessage", (message, options, userId) => {
    if ( userId !== game.user.id ) return;
    const events = chatEvents({authorId: message.author?.id ?? message.user?.id ?? userId, rolls: message.rolls?.length ?? 0,
      whisper: message.whisper ?? [], style: message.style}, {userId: game.user.id, isGm: id => !!game.users.get(id)?.isGM});
    for ( const event of events ) state.emit(event);
  });

  Hooks.on("updateToken", (doc, changes, options, userId) => {
    if ( (userId !== game.user.id) || !doc.isOwner || !state.wanted("move") ) return;
    if ( !(("x" in changes) || ("y" in changes)) ) return;
    const kind = classifyMove({now: Date.now(), lastKeyAt: state.lastKeyAt, lastPointerAt: state.lastPointerAt,
      keyDown: state.keyDown.size > 0});
    if ( kind !== "other" ) state.emit(`move:${kind}`);
  });

  Hooks.on("targetToken", (user, token, targeted) => {
    if ( (user === game.user) && targeted && state.wanted("target") ) state.emit("target");
  });

  Hooks.on("canvasReady", watchPings);
  if ( globalThis.canvas?.ready ) watchPings();
}

/**
 * The event a step waits for, for the listeners.
 * @param {string|null} stepId
 * @returns {string|null}
 */
export function eventOf(stepId) {
  return STEP_DEFS[stepId]?.event ?? null;
}
