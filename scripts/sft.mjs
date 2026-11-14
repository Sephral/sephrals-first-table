import {MODULE_ID, TESTED_VERSIONS, openSettings, setting} from "./config.mjs";
import {registerDebug} from "./debug.mjs";
import {saveDebugFile} from "./debug-file.mjs";
import {registerHubModule} from "./hub.mjs";
import {applyModuleLanguage} from "./language.mjs";
import {openOverview, refreshOverview, syncSteps} from "./overview-app.mjs";
import {inviteUser, progressOf, resetUser, saveProgress, touchesFlags} from "./progress.mjs";
import {noticeNewVersions, runSelfTest} from "./selftest.mjs";
import {changeLanguage, registerSettings} from "./settings.mjs";
import {connect, currentStepId, help, isRunning, offered, redraw, start, startTour, stop} from "./tour.mjs";
import {STEP_IDS, experiencedProgress, isEstablished, progressDelta} from "./tour-logic.mjs";
import {countFeature, registerUsage} from "./usage.mjs";

/** The name of the help tool in the scene controls. */
const TOOL = "sftHelp";

/** What the active GM last saw of every player's progress, to count what changed. */
const seen = new Map();

Hooks.once("init", () => {
  registerHubModule({moduleId: MODULE_ID, tested: TESTED_VERSIONS});
  registerSettings({
    language: value => changeLanguage(value, redraw),
    redraw: () => {
      redraw();
      refreshOverview();
    },
    helpButton: () => ui.controls?.render({reset: true}),
    steps: () => {
      syncSteps();
      redraw();
    },
    openOverview,
    startTour: () => help()
  });
  // Counted only on the active GM's client, like every Sephral module. What a player does shows in their stored
  // progress, which the active GM compares with what it saw before (see countChanges).
  registerUsage(MODULE_ID, {
    features: ["tourStarted", "tourFinished", "tourStopped", "stepDone", "stepSkipped", "markedExperienced",
      "startedForPlayer", "stepsChanged", "previewStarted", "overviewOpened"],
    settings: ["offer", "helpButton", "theme"]
  });
  registerDebug();
  connect({openOverview, openSettings});

  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
  Hooks.on("updateUser", onUpdateUser);
  Hooks.on("userConnected", () => refreshOverview());
  for ( const event of ["createActor", "deleteActor", "updateActor"] ) Hooks.on(event, () => refreshOverview());

  game.modules.get(MODULE_ID).api = {
    /** Open the tour card for this player: start or go on, or the menu. A GM sees the tour in preview. */
    open: () => help(),
    /** Start the tour for this player, from the first step with `restart`. A GM sees it in preview. */
    start: (options = {}) => start({restart: !!options.restart, preview: game.user.isGM}),
    /** Stop the tour for this player. The steps done so far are kept. */
    stop,
    /** Is a step on the card now? */
    isRunning,
    /** The step on the card now, or null. */
    currentStep: currentStepId,
    /** The steps the GM offers. */
    steps: offered,
    /** The ids of all steps. */
    stepIds: () => [...STEP_IDS],
    /** The progress of a user (the id or the user): {status, steps, started, finished}. */
    progress: userOrId => progressOf(typeof userOrId === "string" ? game.users.get(userOrId) : (userOrId ?? game.user)),
    /** GM. Start the tour for a player: the player is asked at the next chance. */
    startFor: userOrId => inviteUser(typeof userOrId === "string" ? game.users.get(userOrId) : userOrId),
    /** GM. Mark a player as experienced, so the tour is never offered. */
    markExperienced: userOrId => {
      const user = typeof userOrId === "string" ? game.users.get(userOrId) : userOrId;
      return saveProgress(experiencedProgress(progressOf(user), Date.now()), user);
    },
    /** GM. Forget everything about the tour of a player. */
    reset: userOrId => resetUser(typeof userOrId === "string" ? game.users.get(userOrId) : userOrId),
    /** GM. Open the overview of the players. */
    openOverview,
    /** Check the module (GM). */
    runSelfTest,
    /** Save the debug file of Sephral's modules (GM). */
    saveDebugFile: messageId => saveDebugFile(messageId ?? null, {moduleId: MODULE_ID})
  };
});

/** Applying a fixed module language loads its file; the rest of "ready" waits for it. */
let languageReady = Promise.resolve();

Hooks.once("i18nInit", () => {
  languageReady = applyModuleLanguage(setting("uiLanguage"));
});

Hooks.once("ready", async () => {
  await languageReady;
  await baseline();
  for ( const user of game.users ) seen.set(user.id, progressOf(user));
  startTour();
  noticeNewVersions();
});

/**
 * The first time the active GM's client starts in a world: a world that is in use does not offer the tour on its own,
 * because its players know the table. The GM can switch the offer on in the settings.
 */
async function baseline() {
  if ( !game.user.isGM || (game.users.activeGM?.id !== game.user.id) ) return;
  if ( setting("baselined") ) return;
  await game.settings.set(MODULE_ID, "baselined", true);
  if ( isEstablished({messages: game.messages.size, combats: game.combats.size}) ) {
    await game.settings.set(MODULE_ID, "offer", "gm");
  }
}

/**
 * A user changed: the progress of a player changes the overview and, on the active GM's client, the usage counters.
 * @param {User} user
 * @param {object} changes
 */
function onUpdateUser(user, changes) {
  if ( !touchesFlags(changes) ) return;
  refreshOverview();
  if ( !game.user.isGM || (game.users.activeGM?.id !== game.user.id) ) return;
  const next = progressOf(user);
  const delta = progressDelta(seen.get(user.id), next);
  seen.set(user.id, next);
  if ( user.isGM ) return;
  if ( delta.done ) countFeature(MODULE_ID, "stepDone", delta.done);
  if ( delta.skipped ) countFeature(MODULE_ID, "stepSkipped", delta.skipped);
  if ( delta.started ) countFeature(MODULE_ID, "tourStarted");
  if ( delta.finished ) countFeature(MODULE_ID, "tourFinished");
  if ( delta.stopped ) countFeature(MODULE_ID, "tourStopped");
  if ( delta.experienced ) countFeature(MODULE_ID, "markedExperienced");
}

/**
 * Hook "getSceneControlButtons": the small help button in the token controls. A player opens the tour, a GM the
 * overview.
 * @param {Record<string, object>|object[]} controls
 */
function onGetSceneControlButtons(controls) {
  if ( !setting("helpButton") ) return;
  const tokens = controls?.tokens ?? (Array.isArray(controls) ? controls.find(c => c.name === "tokens") : null);
  if ( !tokens ) return;
  const open = () => (game.user.isGM ? openOverview() : help());
  const tool = {name: TOOL, title: game.user.isGM ? "SFT.Tool.overview" : "SFT.Tool.help", icon: "fa-solid fa-circle-question",
    button: true, visible: true, onChange: open};
  if ( Array.isArray(tokens.tools) ) tokens.tools.push({...tool, onClick: open});
  else {
    tool.order = 10 + Object.keys(tokens.tools ?? {}).length;
    tokens.tools[tool.name] = tool;
  }
}

