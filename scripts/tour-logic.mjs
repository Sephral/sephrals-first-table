/**
 * The pure logic of the tour: the steps, a player's progress, what to offer and when, how actions are told apart.
 * Nothing here touches Foundry, so the unit tests run it as it is.
 */

/** The steps in the order the tour offers them. */
export const STEP_IDS = ["sheet", "roll", "moveKeys", "moveDrag", "target", "ping", "measure", "chat", "whisper",
  "journal"];

/**
 * What each step waits for.
 * - event: the action that completes it (see the detection in detect.mjs)
 * - needs: what must exist for the player to be able to do it. "character" steps drop out when the player has no
 *   character at all, the others wait (the card says why and offers to skip).
 * - icon: the icon on the card
 */
export const STEP_DEFS = {
  sheet: {event: "sheet", needs: ["character"], icon: "fa-solid fa-id-card"},
  roll: {event: "roll", needs: ["character"], icon: "fa-solid fa-dice-d20"},
  moveKeys: {event: "move:keys", needs: ["ownToken"], icon: "fa-solid fa-keyboard"},
  moveDrag: {event: "move:drag", needs: ["ownToken"], icon: "fa-solid fa-hand-pointer"},
  target: {event: "target", needs: ["otherToken"], icon: "fa-solid fa-crosshairs"},
  ping: {event: "ping", needs: ["canvas"], icon: "fa-solid fa-location-crosshairs"},
  measure: {event: "measure", needs: ["canvas"], icon: "fa-solid fa-ruler"},
  chat: {event: "chat", needs: [], icon: "fa-solid fa-comments"},
  whisper: {event: "whisper", needs: [], icon: "fa-solid fa-user-secret"},
  journal: {event: "journal", needs: [], icon: "fa-solid fa-book-open"}
};

/** The status of a player's tour. A player who never met the tour has no status at all. */
export const STATUS = {
  RUNNING: "running",
  FINISHED: "finished",
  STOPPED: "stopped",
  EXPERIENCED: "experienced",
  LATER: "later"
};

/** How often a player who says "not now" is asked again at a later login. */
export const MAX_OFFERS = 2;

/** A move counts as "with the keys" when a key was pressed this many ms before the token moved. */
export const KEY_WINDOW = 2500;

/** A move counts as "dragged" when the pointer was used on the canvas this many ms before it. */
export const DRAG_WINDOW = 4000;

/** The key codes that move a token in a default Foundry. Custom bindings are added from the key bindings. */
export const DEFAULT_MOVE_CODES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD",
  "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad6", "Numpad7", "Numpad8", "Numpad9"];

/** The chat styles of typed messages (Foundry's CHAT_MESSAGE_STYLES: out of character, in character, emote). */
const TYPED_STYLES = [1, 2, 3];

/* -------------------------------------------- */
/*  Progress                                    */
/* -------------------------------------------- */

/**
 * Clean a stored progress record.
 * @param {*} raw
 * @returns {{status: string, steps: Record<string, string>, started: number, finished: number, updated: number,
 *   offers: number, handledInvite: number}}
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
  return {status, steps, started: num(source.started), finished: num(source.finished), updated: num(source.updated),
    offers: Math.floor(num(source.offers)), handledInvite: num(source.handledInvite)};
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
 * The player starts the tour, or starts it again from the first step.
 * @param {*} prev
 * @param {number} now
 * @param {object} [options]
 * @param {boolean} [options.restart=false]   Forget the steps done so far
 * @returns {object}
 */
export function startProgress(prev, now, {restart = false} = {}) {
  const p = cleanProgress(prev);
  const fresh = restart || (p.status === STATUS.FINISHED) || (p.status === STATUS.EXPERIENCED);
  return {...p, status: STATUS.RUNNING, steps: fresh ? {} : p.steps, started: fresh ? now : (p.started || now),
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

/** The last step is behind the player. */
export function finishProgress(prev, now) {
  return {...cleanProgress(prev), status: STATUS.FINISHED, finished: now, updated: now};
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
 * Is a world already in use? The module then does not offer the tour on its own, because the players know the table.
 * @param {{messages: number, combats: number}} counts
 * @returns {boolean}
 */
export function isEstablished({messages = 0, combats = 0} = {}) {
  return (combats > 0) || (messages >= 30);
}

/* -------------------------------------------- */
/*  Plan                                        */
/* -------------------------------------------- */

/**
 * The steps this player has in the tour now.
 * @param {object} options
 * @param {string[]} options.offered     The steps the GM offers
 * @param {*} options.progress           The player's progress
 * @param {Record<string, boolean>} options.ctx   What exists: {character, ownToken, otherToken, canvas}
 * @returns {{id: string, state: "todo"|"done"|"skipped", missing: string[]}[]}
 */
export function planSteps({offered, progress, ctx}) {
  const steps = cleanProgress(progress).steps;
  const plan = [];
  for ( const id of STEP_IDS ) {
    if ( !offered.includes(id) ) continue;
    const def = STEP_DEFS[id];
    if ( def.needs.includes("character") && !ctx.character ) continue;
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
 * Does an action complete a step?
 * @param {string} stepId
 * @param {string} event   "sheet", "roll", "move:keys", ...
 * @returns {boolean}
 */
export function completes(stepId, event) {
  return STEP_DEFS[stepId]?.event === event;
}

/**
 * The language key for what to do in a step: a text for the game system when there is one, then one for the Foundry
 * generation (the keys that move a token differ), then the general text.
 * @param {string} stepId
 * @param {string} systemId
 * @param {(key: string) => boolean} has   Whether a key exists
 * @param {number} [generation]            Foundry's generation, 13 or 14
 * @returns {string}
 */
export function doKey(stepId, systemId, has, generation = 0) {
  const base = `SFT.STEPS.${stepId}.do`;
  const cap = String(systemId ?? "").replace(/[^a-z0-9]/gi, "");
  const system = `${base}${cap.charAt(0).toUpperCase()}${cap.slice(1).toLowerCase()}`;
  if ( cap && has(system) ) return system;
  const version = `${base}V${generation}`;
  return (generation && has(version)) ? version : base;
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
 * @param {object} who
 * @param {string} who.userId            The player
 * @param {(id: string) => boolean} who.isGm   Is this user a GM?
 * @returns {string[]}   The events: "roll", "chat" (typed text, also whispered), "whisper" (to a GM)
 */
export function chatEvents(message, {userId, isGm}) {
  if ( message?.authorId !== userId ) return [];
  const events = [];
  const whisper = Array.isArray(message.whisper) ? message.whisper : [];
  if ( message.rolls > 0 ) events.push("roll");
  else {
    if ( TYPED_STYLES.includes(message.style) || (whisper.length > 0) ) events.push("chat");
    if ( whisper.some(id => isGm(id)) ) events.push("whisper");
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

/* -------------------------------------------- */
/*  The GM's overview                           */
/* -------------------------------------------- */

/**
 * What the GM sees of one player.
 * @param {*} progress
 * @param {{offered: string[], ctx: Record<string, boolean>}} options
 * @returns {{status: string, done: number, skipped: number, total: number, percent: number}}
 */
export function playerSummary(progress, {offered, ctx}) {
  const p = cleanProgress(progress);
  const plan = planSteps({offered, progress: p, ctx});
  const c = counts(plan);
  const finished = (p.status === STATUS.FINISHED);
  return {status: p.status || "new", done: c.done, skipped: c.skipped, total: c.total,
    percent: finished ? 100 : (c.total ? Math.round(((c.done + c.skipped) / c.total) * 100) : 0)};
}

/**
 * What changed between two states of a player's progress, for the usage counters on the GM's side.
 * @param {*} prev
 * @param {*} next
 * @returns {{done: number, skipped: number, started: boolean, finished: boolean, stopped: boolean,
 *   experienced: boolean}}
 */
export function progressDelta(prev, next) {
  const a = cleanProgress(prev);
  const b = cleanProgress(next);
  const changed = state => Object.entries(b.steps).filter(([id, value]) => (value === state) && (a.steps[id] !== state)).length;
  return {
    done: changed("done"),
    skipped: changed("skipped"),
    started: (b.status === STATUS.RUNNING) && (a.status !== STATUS.RUNNING),
    finished: (b.status === STATUS.FINISHED) && (a.status !== STATUS.FINISHED),
    stopped: (b.status === STATUS.STOPPED) && (a.status !== STATUS.STOPPED),
    experienced: (b.status === STATUS.EXPERIENCED) && (a.status !== STATUS.EXPERIENCED)
  };
}
