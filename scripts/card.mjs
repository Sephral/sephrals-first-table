/**
 * The tour card and the ring that shows where to look. Both are plain elements on the page: small, not modal, never in
 * the way of the canvas. The card can be dragged by its header, folded to a small pill and moved out of the way.
 */

import {esc, setting, t} from "./config.mjs";

/** The card element, or null while none is shown. */
let card = null;

/** The ring element and its refresh timer. */
let ring = null;
let ringTimer = null;
let ringHide = null;

/** What the card shows now, so a language change or a fold can draw it again. */
let current = null;
let handler = () => {};

/** Where the player moved the card to ({x, y} in pixels from the top left), or null for the default place. */
let place = null;

/**
 * Set the function that receives the clicks of the card.
 * @param {(action: string, event: Event) => void} fn
 */
export function onAction(fn) {
  handler = fn;
}

/**
 * Is a card shown?
 * @returns {boolean}
 */
export function isShown() {
  return !!card;
}

/** The mode of the card now. */
export function shownMode() {
  return card ? (current?.mode ?? null) : null;
}

/**
 * Show a card, or replace the one shown.
 * @param {object} model
 * @param {string} model.mode      "offer", "invited", "step", "flash", "done", "menu" or "tip"
 * @param {string} [model.icon]    Icon classes
 * @param {string} model.kicker    The small line above the title
 * @param {string} model.title
 * @param {string} [model.text]
 * @param {string} [model.todo]    What to do
 * @param {string} [model.note]    A hint, for example why the step cannot be done right now
 * @param {{action: string, label: string, meta?: string, icon?: string, state?: string, primary?: boolean}[]} [model.list]
 *   A list of choices below the text (the chapters)
 * @param {{total: number, done: number}} [model.progress]   Dots under the header
 * @param {{action: string, label: string, primary?: boolean, icon?: string, tooltip?: string}[]} [model.buttons]
 * @param {{action: string, label: string}} [model.link]     A quiet link at the end of the footer
 * @param {boolean} [model.folded]   Show only the pill
 */
export function showCard(model) {
  current = model;
  if ( !card ) {
    card = document.createElement("aside");
    card.className = "sft-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-live", "polite");
    card.addEventListener("click", onClick);
    document.body.append(card);
    applyPlace();
  }
  card.dataset.mode = model.mode;
  card.dataset.sftTheme = setting("theme");
  card.classList.toggle("is-folded", !!model.folded);
  card.setAttribute("aria-label", t("SFT.card.label"));
  card.innerHTML = model.folded ? pillHtml(model) : cardHtml(model);
  const head = card.querySelector(".sft-head");
  if ( head ) head.addEventListener("pointerdown", startDrag);
  keepOnScreen();
}

/**
 * The markup of a card as an element that does not float (for the sample windows): the same card or pill as on the screen.
 * @param {object} model   See showCard
 * @returns {string}
 */
export function cardMarkup(model) {
  return `<aside class="sft-card${model.folded ? " is-folded" : ""}" data-mode="${esc(model.mode)}" data-sft-theme="${
    esc(setting("theme"))}" aria-label="${esc(t("SFT.card.label"))}">${model.folded ? pillHtml(model) : cardHtml(model)}</aside>`;
}

/** Remove the card. */
export function hideCard() {
  card?.remove();
  card = null;
  current = null;
}

/**
 * The card as small pill with the step count.
 * @param {object} model
 * @returns {string}
 */
function pillHtml(model) {
  const {progress} = model;
  const label = progress ? t("SFT.card.pill", {done: progress.done, total: progress.total}) : t("SFT.card.pillShort");
  return `<button type="button" class="sft-pill" data-action="unfold" data-tooltip="${esc(t("SFT.card.unfold"))}"
    aria-label="${esc(t("SFT.card.unfold"))}"><i class="${esc(model.icon ?? "fa-solid fa-compass")}" inert></i>
    <span>${esc(label)}</span></button>`;
}

/**
 * The card's markup.
 * @param {object} model
 * @returns {string}
 */
function cardHtml(model) {
  const dots = model.progress
    ? `<div class="sft-dots" role="img" aria-label="${esc(t("SFT.card.pill", model.progress))}">${
      Array.from({length: model.progress.total}, (_, i) => {
        const state = (i < model.progress.done) ? "is-done" : ((i === model.progress.done) ? "is-now" : "");
        return `<span class="${state}"></span>`;
      }).join("")}</div>`
    : "";
  const buttons = (model.buttons ?? []).map(b => `<button type="button" class="${b.primary ? "sft-primary" : ""}"
    data-action="${esc(b.action)}"${b.tooltip ? ` data-tooltip="${esc(b.tooltip)}"` : ""}>${
    b.icon ? `<i class="${esc(b.icon)}" inert></i> ` : ""}${esc(b.label)}</button>`).join("");
  const link = model.link ? `<button type="button" class="sft-link" data-action="${esc(model.link.action)}">${
    esc(model.link.label)}</button>` : "";
  return `<header class="sft-head">
      <i class="sft-icon ${esc(model.icon ?? "fa-solid fa-compass")}" inert></i>
      <span class="sft-kicker">${esc(model.kicker)}</span>
      <span class="sft-spacer"></span>
      <button type="button" class="sft-icon-button" data-action="gear" data-tooltip="${esc(t("SFT.gear"))}"
        aria-label="${esc(t("SFT.gear"))}"><i class="fa-solid fa-gear" inert></i></button>
      ${model.mode === "step" || model.mode === "flash" ? `<button type="button" class="sft-icon-button" data-action="fold"
        data-tooltip="${esc(t("SFT.card.fold"))}" aria-label="${esc(t("SFT.card.fold"))}"><i class="fa-solid fa-minus" inert></i></button>` : ""}
    </header>
    ${dots}
    <h3 class="sft-title">${esc(model.title)}</h3>
    ${model.text ? `<p class="sft-text">${esc(model.text)}</p>` : ""}
    ${model.todo ? `<p class="sft-todo"><i class="fa-solid fa-hand-point-right" inert></i> <span>${esc(model.todo)}</span></p>` : ""}
    ${listHtml(model.list)}
    ${model.note ? `<p class="sft-note"><i class="fa-solid fa-circle-info" inert></i> <span>${esc(model.note)}</span></p>` : ""}
    <footer class="sft-foot">${buttons}<span class="sft-spacer"></span>${link}</footer>`;
}

/**
 * The list of choices of a card.
 * @param {object[]|undefined} list
 * @returns {string}
 */
function listHtml(list) {
  if ( !list?.length ) return "";
  const rows = list.map(item => `<li>${item.redo ? `<button type="button" class="sft-redo" data-action="${esc(item.redo.action)}"
    data-tooltip="${esc(item.redo.label)}" aria-label="${esc(item.redo.label)}"><i class="fa-solid fa-rotate-left" inert></i></button>` : ""}<button type="button" class="sft-choice${item.primary ? " is-primary" : ""}"
    data-action="${esc(item.action)}" data-state="${esc(item.state ?? "")}"><i class="sft-choice-icon ${esc(item.icon ?? "")}" inert></i>
    <span class="sft-choice-text"><strong>${esc(item.label)}</strong>${item.meta ? `<small>${esc(item.meta)}</small>` : ""}</span>
    <i class="sft-choice-state fa-solid ${item.state === "done" ? "fa-circle-check" : "fa-chevron-right"}" inert></i></button></li>`);
  return `<ul class="sft-list">${rows.join("")}</ul>`;
}

/** @param {MouseEvent} event */
function onClick(event) {
  const target = event.target.closest("[data-action]");
  if ( !target || !card?.contains(target) ) return;
  event.preventDefault();
  event.stopPropagation();
  handler(target.dataset.action, event);
}

/* -------------------------------------------- */
/*  Place                                       */
/* -------------------------------------------- */

/**
 * Set the place the player moved the card to.
 * @param {{x: number, y: number}|null} value
 */
export function setPlace(value) {
  place = (value && Number.isFinite(value.x) && Number.isFinite(value.y)) ? value : null;
  applyPlace();
}

function applyPlace() {
  if ( !card ) return;
  if ( place ) {
    card.style.left = `${place.x}px`;
    card.style.top = `${place.y}px`;
    card.style.bottom = "auto";
  }
  else {
    card.style.left = "";
    card.style.top = "";
    card.style.bottom = "";
  }
}

/** Keep the card inside the window after the window or the card changed size. */
export function keepOnScreen() {
  if ( !card || !place ) return;
  const rect = card.getBoundingClientRect();
  const x = Math.min(Math.max(0, place.x), Math.max(0, window.innerWidth - rect.width));
  const y = Math.min(Math.max(0, place.y), Math.max(0, window.innerHeight - 40));
  if ( (x !== place.x) || (y !== place.y) ) {
    place = {x, y};
    applyPlace();
  }
}

/** @param {PointerEvent} event */
function startDrag(event) {
  if ( event.button !== 0 || event.target.closest("button") ) return;
  const rect = card.getBoundingClientRect();
  const dx = event.clientX - rect.left;
  const dy = event.clientY - rect.top;
  card.classList.add("is-dragging");
  const move = e => {
    place = {x: Math.round(e.clientX - dx), y: Math.round(e.clientY - dy)};
    applyPlace();
    keepOnScreen();
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    card?.classList.remove("is-dragging");
    handler("moved", {place});
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
  event.preventDefault();
}

/** The place now, for the setting. */
export function currentPlace() {
  return place ? {...place} : null;
}

/* -------------------------------------------- */
/*  Ring                                        */
/* -------------------------------------------- */

/**
 * Show a pulsing ring around a part of the screen for a few seconds.
 * @param {() => ({left: number, top: number, width: number, height: number}|null)} getRect   Where to draw it, called
 *   again while the ring is shown
 * @param {number} [seconds=7]
 */
export function showRing(getRect, seconds = 7) {
  hideRing();
  const first = getRect();
  if ( !first ) return;
  ring = document.createElement("div");
  ring.className = "sft-ring";
  ring.dataset.sftTheme = setting("theme");
  document.body.append(ring);
  const place = () => {
    const rect = getRect();
    if ( !rect || !ring ) return hideRing();
    const pad = 6;
    ring.style.left = `${rect.left - pad}px`;
    ring.style.top = `${rect.top - pad}px`;
    ring.style.width = `${rect.width + (pad * 2)}px`;
    ring.style.height = `${rect.height + (pad * 2)}px`;
  };
  place();
  ringTimer = setInterval(place, 400);
  ringHide = setTimeout(hideRing, seconds * 1000);
}

/** Remove the ring. */
export function hideRing() {
  clearInterval(ringTimer);
  clearTimeout(ringHide);
  ringTimer = null;
  ringHide = null;
  ring?.remove();
  ring = null;
}

/**
 * The screen rectangle of an element, or null while it is not shown or lies outside the window (a collapsed sidebar
 * slides out of sight, a ring there would point at nothing).
 * @param {Element|null} element
 * @returns {{left: number, top: number, width: number, height: number}|null}
 */
export function rectOfElement(element) {
  if ( !element?.getBoundingClientRect ) return null;
  const rect = element.getBoundingClientRect();
  const inside = (rect.right > 0) && (rect.bottom > 0) && (rect.left < window.innerWidth) && (rect.top < window.innerHeight);
  return ((rect.width > 0) && (rect.height > 0) && inside) ? {left: rect.left, top: rect.top, width: rect.width, height: rect.height} : null;
}

/**
 * The screen rectangle of the first element a selector finds that is shown.
 * @param {string[]} selectors
 * @param {ParentNode} [root=document]
 * @returns {{left: number, top: number, width: number, height: number}|null}
 */
export function rectOfSelector(selectors, root = document) {
  for ( const selector of selectors ) {
    for ( const element of root.querySelectorAll(selector) ) {
      const rect = rectOfElement(element);
      if ( rect ) return rect;
    }
  }
  return null;
}

/**
 * The screen rectangle of a token on the canvas.
 * @param {Token|null} token
 * @returns {{left: number, top: number, width: number, height: number}|null}
 */
export function rectOfToken(token) {
  if ( !token || !globalThis.canvas?.ready ) return null;
  const view = canvas.app?.view?.getBoundingClientRect();
  const {x, y, width, height} = token.bounds;
  const a = canvas.clientCoordinatesFromCanvas({x, y});
  const b = canvas.clientCoordinatesFromCanvas({x: x + width, y: y + height});
  const rect = {left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y};
  if ( view && ((rect.left + rect.width < view.left) || (rect.top + rect.height < view.top) || (rect.left > view.right)
    || (rect.top > view.bottom)) ) return null;
  return rect;
}

