/**
 * Detecting what the player does. The tour never watches a player who is not on a step: the listeners that cost
 * something (keys, pointer, the measuring poll) run only while the tour is on a step that needs them.
 *
 * Every detection calls emit(event) with an event name such as "sheet", "roll", "roll:skill", "move:keys", "target",
 * "ping", "measure", "chat", "whisper", "journal", "tab:<sidebar tab>", "control:<layer>", "tool:<tool>", "rollmode",
 * "sheetTab:<tab>", "item", "rest", "app:settings", "app:controls", "volume", "initiative", "turnEnd", "turn:mine",
 * "hud", "hud:effects", "elevation", "ui:hotbar", "ui:players", "macro", "inline", "emote", "whisper:any", "roll:typed",
 * "roll:private" or "rollOpen". What an event completes is decided in tour-logic.mjs.
 */

import {MODULE_ID} from "./config.mjs";
import {DEFAULT_MOVE_CODES, SHEET_ROLL_WINDOW, STEP_DEFS, TYPED_WINDOW, appKind, chatEvents, classifyMove, controlEvent,
  isMeasuring, isOwnPing} from "./tour-logic.mjs";

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
  pings: null,
  lastClickAt: 0,
  typed: {text: "", at: 0},
  sheetRoll: {type: "", at: 0}
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

/**
 * The text of what the player typed: Foundry 14 passes the HTML of its chat editor, Foundry 13 plain text.
 * @param {*} value
 * @returns {string}
 */
function plainText(value) {
  const text = String(value ?? "");
  if ( !text.includes("<") ) return text.trim();
  try {
    return (new DOMParser().parseFromString(text, "text/html").body.textContent ?? "").trim();
  } catch(err) {
    return text.replace(/<[^>]*>/g, " ").trim();
  }
}

/**
 * The actor sheet an element sits in, when it is a sheet of an actor the player owns.
 * @param {Element} element
 * @returns {object|null}
 */
function ownSheetOf(element) {
  const frame = element?.closest?.(".application, .window-app");
  if ( !frame ) return null;
  const app = foundry.applications?.instances?.get(frame.id) ?? ui.windows?.[frame.dataset.appid];
  const doc = documentOf(app);
  return ((doc?.documentName === "Actor") && doc.isOwner) ? app : null;
}

/**
 * Every click on the page, looked at only as far as a step wants it. A click on a sidebar tab is read here, because a
 * click on the tab that is already open changes nothing for Foundry.
 */
function onClick(event) {
  const target = event.target;
  if ( !target?.closest ) return;
  const wanted = state.wanted;
  const tab = target.closest("#sidebar-tabs [data-tab]");
  if ( tab ) {
    state.lastClickAt = Date.now();
    const name = tab.dataset.tab;
    if ( wanted("tab") ) state.emit(`tab:${name}`);
    if ( (name === "journal") && wanted("journal") ) state.emit("journal");
    return;
  }
  const control = target.closest("#scene-controls [data-control]");
  if ( control ) {
    if ( wanted("control") ) state.emit(controlEvent(control.dataset.control));
    return;
  }
  const tool = target.closest("#scene-controls [data-tool]");
  if ( tool ) {
    if ( !wanted("tool") ) return;
    const name = tool.dataset.tool;
    // The help button opens the card itself: let it do that first
    if ( name === "sftHelp" ) setTimeout(() => state.emit("tool:sftHelp"), 150);
    else state.emit(`tool:${name}`);
    return;
  }
  if ( target.closest("#chat-controls [data-action='rollMode'], #chat-controls [data-action='messageMode']") ) {
    if ( wanted("rollmode") ) state.emit("rollmode");
    return;
  }
  if ( target.closest(".dice-roll") && target.closest("#chat, #chat-notifications, .chat-popout") ) {
    if ( wanted("rollOpen") ) state.emit("rollOpen");
    return;
  }
  if ( target.closest("#combat [data-action='nextTurn']") ) {
    if ( wanted("turnEnd") ) state.emit("turnEnd");
    return;
  }
  if ( target.closest("#token-hud [data-action='togglePalette'][data-palette='effects']") ) {
    if ( wanted("hud") ) state.emit("hud:effects");
    return;
  }
  if ( target.closest("#hotbar") ) {
    if ( wanted("ui") ) state.emit("ui:hotbar");
    return;
  }
  if ( target.closest("#players") ) {
    if ( wanted("ui") ) state.emit("ui:players");
    return;
  }
  // The sheet: a tab, a roll link (remembered for the chat message that follows), the rest button
  const link = target.closest("a[data-tab], button[data-tab]");
  if ( link && ownSheetOf(link) ) {
    if ( wanted("sheetTab") ) state.emit(`sheetTab:${link.dataset.tab}`);
    return;
  }
  const roll = target.closest("[data-action='roll'][data-type]");
  if ( roll && ownSheetOf(roll) ) {
    state.sheetRoll = {type: roll.dataset.type, at: Date.now()};
    return;
  }
  if ( target.closest("[data-action='rest']") && ownSheetOf(target) && wanted("rest") ) state.emit("rest");
}

/** A volume slider of the playlists moved. */
function onInput(event) {
  const target = event.target;
  if ( (target?.type === "range") && target.closest?.("#playlists") && state.wanted("volume") ) state.emit("volume");
}

/** The elevation field of the token HUD changed. */
function onChange(event) {
  const target = event.target;
  if ( (target?.name === "elevation") && target.closest?.("#token-hud") && state.wanted("elevation") ) state.emit("elevation");
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
 * A window was drawn: the player's character sheet or an item, a journal, the settings windows.
 * @param {Application|ApplicationV2} app
 */
function onRenderApp(app) {
  const kind = appKind({id: app?.id ?? app?.options?.id, name: app?.constructor?.name});
  if ( kind && state.wanted("app") ) return state.emit(`app:${kind}`);
  const doc = documentOf(app);
  if ( !doc ) return;
  if ( (doc.documentName === "Actor") && doc.isOwner && state.wanted("sheet") ) state.emit("sheet");
  else if ( (doc.documentName === "Item") && (doc.parent?.documentName === "Actor") && doc.parent.isOwner
    && state.wanted("item") ) state.emit("item");
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
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onChange, true);

  // Windows: Foundry 13 and 14 call a hook per class in the window's chain, and older sheets use the other name
  Hooks.on("renderApplicationV2", onRenderApp);
  Hooks.on("renderApplication", onRenderApp);
  Hooks.on("changeSidebarTab", app => {
    const name = app?.constructor?.tabName ?? app?.tabName ?? app?.options?.id ?? ui.sidebar?.activeTab;
    // A click on a tab was read already
    if ( (Date.now() - state.lastClickAt) < 500 ) return;
    if ( name && state.wanted("tab") ) state.emit(`tab:${name}`);
    if ( (name === "journal") && state.wanted("journal") ) state.emit("journal");
  });

  // What the player typed, to tell a typed roll from one made on the sheet. Foundry 14 hands over the HTML of its editor.
  Hooks.on("chatMessage", (log, text) => {
    state.typed = {text: plainText(text), at: Date.now()};
  });

  Hooks.on("createChatMessage", (message, options, userId) => {
    if ( userId !== game.user.id ) return;
    const now = Date.now();
    const typed = ((now - state.typed.at) <= TYPED_WINDOW) ? state.typed.text : "";
    const sheetRoll = ((now - state.sheetRoll.at) <= SHEET_ROLL_WINDOW) ? state.sheetRoll.type : "";
    const events = chatEvents({authorId: message.author?.id ?? message.user?.id ?? userId, rolls: message.rolls?.length ?? 0,
      whisper: message.whisper ?? [], style: message.style, content: message.content, typed, sheetRoll},
    {userId: game.user.id, isGm: id => !!game.users.get(id)?.isGM});
    if ( events.includes("roll") ) state.sheetRoll = {type: "", at: 0};
    if ( typed ) state.typed = {text: "", at: 0};
    for ( const event of events ) state.emit(event);
  });

  Hooks.on("updateCombatant", (combatant, changes, options, userId) => {
    if ( (userId !== game.user.id) || !combatant.isOwner || !state.wanted("initiative") ) return;
    if ( Number.isFinite(changes.initiative) ) state.emit("initiative");
  });

  Hooks.on("combatTurnChange", (combat, prior, current) => {
    if ( !state.wanted("turn") || game.user.isGM ) return;
    if ( combat.combatants?.get(current?.combatantId)?.isOwner ) state.emit("turn:mine");
  });

  Hooks.on("renderTokenHUD", hud => {
    if ( hud?.object?.document?.isOwner && state.wanted("hud") ) state.emit("hud");
  });

  Hooks.on("createMacro", (macro, options, userId) => {
    if ( (userId === game.user.id) && state.wanted("macro") ) state.emit("macro");
  });

  Hooks.on("updateToken", (doc, changes, options, userId) => {
    if ( (userId === game.user.id) && doc.isOwner && ("elevation" in changes) && state.wanted("elevation") ) {
      state.emit("elevation");
    }
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
