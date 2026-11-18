/**
 * Self test: what the module relies on in Foundry, its logic and its texts.
 */

import {MODULE_ID, TEMPLATES, TESTED_VERSIONS, esc, t} from "./config.mjs";
import {CHAPTER_IDS, STEP_IDS, appKind, chatEvents, classifyMove, completes, controlEvent, isMeasuring, offerKind,
  permissiveContext, planSteps, progressDelta, startProgress, markStep, currentStep, tipDue} from "./tour-logic.mjs";

/**
 * Run all checks.
 * @returns {Promise<{problems: string[], checks: number}>}
 */
async function checkAll() {
  const problems = [];
  let checks = 0;
  const check = (ok, key, data) => {
    checks++;
    if ( !ok ) problems.push(game.i18n.has(key) ? t(key, data) : key);
  };
  const api = foundry.applications?.api;
  check(typeof api?.DialogV2 === "function", "SFT.SELFTEST.Dialog");
  check(typeof api?.ApplicationV2 === "function" && typeof api?.HandlebarsApplicationMixin === "function",
    "SFT.SELFTEST.Application");
  check(typeof foundry.applications?.handlebars?.renderTemplate === "function", "SFT.SELFTEST.Templates");
  for ( const key of ["overview.hbs"] ) {
    const ok = await fetch(`${TEMPLATES}/${key}`, {method: "HEAD"}).then(r => r.ok).catch(() => false);
    check(ok, "SFT.SELFTEST.Template", {file: key});
  }

  // What the detection reads: chat styles, the sidebar, the map's pings and ruler, the user flags, the keys
  const styles = CONST.CHAT_MESSAGE_STYLES ?? {};
  check((styles.OOC === 1) && (styles.IC === 2) && (styles.EMOTE === 3), "SFT.SELFTEST.Chat");
  check(typeof ui.sidebar?.changeTab === "function" && !!game.keybindings?.bindings, "SFT.SELFTEST.Sidebar");
  check(typeof game.user?.update === "function" && !!game.users && (typeof game.users.activeGM !== "undefined"),
    "SFT.SELFTEST.User");
  check(!!game.i18n && (typeof game.i18n.has === "function"), "SFT.SELFTEST.I18n");
  // What the chapters point at: the sidebar tabs and the scene controls
  const tabs = document.querySelectorAll("#sidebar-tabs [data-tab]");
  check((tabs.length > 0) && !!document.querySelector("#scene-controls [data-control]") && !!ui.controls?.controls,
    "SFT.SELFTEST.Ui");
  check(!!document.querySelector("#chat-controls") && !!document.querySelector("#hotbar") && !!document.querySelector("#players"),
    "SFT.SELFTEST.Chat2");
  if ( canvas?.ready ) {
    const controls = canvas.controls;
    check(!!controls?.pings && (typeof controls.pings.on === "function") && (typeof canvas.ping === "function"),
      "SFT.SELFTEST.Ping");
    const ruler = controls?.ruler;
    check(!!ruler && ("active" in ruler) && (("path" in ruler) || ("waypoints" in ruler)), "SFT.SELFTEST.Ruler");
    check(typeof canvas.clientCoordinatesFromCanvas === "function" && !!canvas.app?.view, "SFT.SELFTEST.Canvas");
  }

  // The logic on a small example
  const ctx = {...permissiveContext("dnd5e"), otherToken: false};
  let progress = startProgress({}, 1, {chapter: "basics"});
  progress = markStep(progress, "sheet", "done", 2);
  const list = planSteps({offered: STEP_IDS, progress, ctx, chapter: "basics"});
  const next = currentStep(list);
  check((list.length === 10) && (next?.id === "roll") && (CHAPTER_IDS.length === 7) && completes("sbChat", "tab:chat")
    && (controlEvent("regions") === "control:shapes") && (appKind({id: "controls"}) === "controls")
    && !tipDue({tip: "combatStart", progress: {chapters: ["fight"]}, mode: "auto", isGM: false})
    && tipDue({tip: "combatStart", progress: {}, mode: "auto", isGM: false})
    && (classifyMove({now: 100, lastKeyAt: 90, lastPointerAt: 0}) === "keys")
    && (classifyMove({now: 100, lastKeyAt: 0, lastPointerAt: 90}) === "drag")
    && (chatEvents({authorId: "a", rolls: 0, whisper: ["g"], style: 0}, {userId: "a", isGm: id => id === "g"}).join() === "chat,whisper,whisper:any")
    && isMeasuring([{x: 0, y: 0}, {x: 5, y: 0}]) && !isMeasuring([{x: 1, y: 1}])
    && (offerKind({progress: {}, mode: "auto", isGM: false}) === "offer")
    && progressDelta({}, progress).done === 1, "SFT.SELFTEST.Logic");

  // Every step has its texts
  const keys = ["SFT.gear", "SFT.SELFTEST.Title", "SFT.Overview.title", "SFT.offer.title", "SFT.done.title", "SFT.menu.title"];
  for ( const id of STEP_IDS ) keys.push(`SFT.STEPS.${id}.title`, `SFT.STEPS.${id}.text`, `SFT.STEPS.${id}.do`);
  for ( const id of CHAPTER_IDS ) keys.push(`SFT.CHAPTERS.${id}.title`);
  keys.push("SFT.TIPS.combatStart.title", "SFT.TIPS.myTurn.title", "SFT.card.doneGeneral");
  const missing = keys.filter(key => !game.i18n.has(key));
  check(!missing.length, "SFT.SELFTEST.Texts", {keys: missing.join(", ")});
  return {problems, checks};
}

/**
 * Run the self test and report the result.
 * @param {object} [options]
 * @param {boolean} [options.report=true]
 * @returns {Promise<{problems: string[], checks: number}>}
 */
export async function runSelfTest({report = true} = {}) {
  const {problems, checks} = await checkAll();
  const summary = problems.length ? t("SFT.SELFTEST.Problems", {problems: problems.length, checks})
    : t("SFT.SELFTEST.Passed", {checks});
  if ( problems.length ) ui.notifications.warn(summary, {permanent: true});
  else ui.notifications.info(summary);
  if ( report ) {
    const versions = t("SFT.SELFTEST.Version", {current: game.version, tested: TESTED_VERSIONS.core});
    let content = `<h3>${esc(t("SFT.SELFTEST.Title"))}</h3><p>${esc(summary)}</p><p><small>${esc(versions)}</small></p>`;
    if ( problems.length ) content += `<ul>${problems.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
    await ChatMessage.implementation.create({content, whisper: [game.user.id],
      speaker: {alias: game.modules.get(MODULE_ID).title}});
  }
  return {problems, checks};
}

/**
 * Tell the GM once when Foundry is newer than the version the module was verified against.
 */
export function noticeNewVersions() {
  if ( !game.user.isGM ) return;
  if ( !foundry.utils.isNewerVersion(game.version, TESTED_VERSIONS.core) ) return;
  const signature = `core ${game.version}`;
  if ( game.settings.get(MODULE_ID, "acknowledgedVersions") === signature ) return;
  game.settings.set(MODULE_ID, "acknowledgedVersions", signature);
  ui.notifications.info(t("SFT.SELFTEST.NewVersions", {versions: signature}), {permanent: true});
}
