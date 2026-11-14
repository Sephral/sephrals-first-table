/**
 * The GM's overview: who finished the tour, start it for a player, mark players as experienced and choose which steps
 * are offered. Opens only when the GM asks, never on its own.
 */

import {MODULE_ID, TEMPLATES, addSettingsGear, isShown, setting, t} from "./config.mjs";
import {inviteUser, progressOf, resetUser, saveProgress} from "./progress.mjs";
import {STATUS, STEP_DEFS, STEP_IDS, experiencedProgress, offeredSteps, playerSummary, stepsSetting} from "./tour-logic.mjs";
import {start as startTour} from "./tour.mjs";
import {countFeature} from "./usage.mjs";
import {trace} from "./trace.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/** The id of the window. */
export const OVERVIEW_ID = "sft-overview";

/**
 * The actor a player is known by: the assigned character, else an actor the player owns.
 * @param {User} user
 * @returns {Actor|null}
 */
function characterOf(user) {
  if ( user.character ) return user.character;
  return game.actors.find(actor => actor.type === "character" && actor.testUserPermission(user, "OWNER"))
    ?? game.actors.find(actor => actor.testUserPermission(user, "OWNER")) ?? null;
}

export class OverviewApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: OVERVIEW_ID,
    classes: ["sft-app", "sft-overview"],
    tag: "section",
    window: {title: "SFT.Overview.title", icon: "fa-solid fa-users-viewfinder", resizable: true},
    position: {width: 640, height: "auto"},
    actions: {
      invite: OverviewApp.#onInvite,
      experienced: OverviewApp.#onExperienced,
      reset: OverviewApp.#onReset,
      allExperienced: OverviewApp.#onAllExperienced,
      preview: OverviewApp.#onPreview
    }
  };

  /** @override */
  static PARTS = {main: {template: `${TEMPLATES}/overview.hbs`, scrollable: [".sft-rows"]}};

  /** @override */
  get title() {
    return t("SFT.Overview.title");
  }

  /** @override */
  async _prepareContext() {
    const offered = offeredSteps(setting("steps"));
    const ctx = {character: true, ownToken: true, otherToken: true, canvas: true};
    const players = game.users.filter(user => !user.isGM).map(user => {
      const summary = playerSummary(progressOf(user), {offered, ctx: {...ctx, character: !!characterOf(user)}});
      const status = summary.status;
      return {
        id: user.id,
        name: user.name,
        color: user.color?.css ?? user.color ?? "#888888",
        active: user.active,
        character: characterOf(user)?.name ?? "",
        status,
        statusLabel: t(`SFT.Overview.status.${status}`),
        done: summary.done,
        skipped: summary.skipped,
        total: summary.total,
        percent: summary.percent,
        isExperienced: status === STATUS.EXPERIENCED,
        isFinished: status === STATUS.FINISHED,
        startLabel: (status === "new") ? t("SFT.Overview.start") : t("SFT.Overview.startAgain"),
        experiencedLabel: (status === STATUS.EXPERIENCED) ? t("SFT.Overview.notExperienced") : t("SFT.Overview.experienced"),
        counts: t("SFT.Overview.counts", {done: summary.done + summary.skipped, total: summary.total})
      };
    });
    const mode = setting("offer");
    return {
      theme: setting("theme"),
      players,
      noPlayers: !players.length,
      steps: STEP_IDS.map(id => ({id, icon: STEP_DEFS[id].icon, title: t(`SFT.STEPS.${id}.title`),
        offered: offered.includes(id)})),
      modeText: t(`SFT.Overview.mode.${mode}`),
      text: {
        hint: t("SFT.Overview.hint"),
        players: t("SFT.Overview.players"),
        noPlayers: t("SFT.Overview.noPlayers"),
        steps: t("SFT.Overview.steps"),
        stepsHint: t("SFT.Overview.stepsHint"),
        allExperienced: t("SFT.Overview.allExperienced"),
        preview: t("SFT.Overview.preview"),
        reset: t("SFT.Overview.reset"),
        online: t("SFT.Overview.online"),
        offline: t("SFT.Overview.offline"),
        mode: t("SFT.Overview.modeLabel")
      }
    };
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    addSettingsGear(frame);
    return frame;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.sftTheme = setting("theme");
    for ( const box of this.element.querySelectorAll("input[data-step]") ) {
      box.addEventListener("change", () => this.#saveSteps());
    }
  }

  /** The GM ticked or unticked a step. */
  async #saveSteps() {
    const offered = [...this.element.querySelectorAll("input[data-step]")].filter(box => box.checked)
      .map(box => box.dataset.step);
    await game.settings.set(MODULE_ID, "steps", stepsSetting(offered));
    countFeature(MODULE_ID, "stepsChanged");
    trace.add("stepsChanged", {offered});
  }

  /** The user of a button's row. */
  static #userOf(target) {
    return game.users.get(target.closest("[data-user-id]")?.dataset.userId);
  }

  static async #onInvite(event, target) {
    const user = OverviewApp.#userOf(target);
    if ( !user ) return;
    await inviteUser(user);
    countFeature(MODULE_ID, "startedForPlayer");
    trace.add("invited", {});
    ui.notifications.info(t("SFT.Overview.invited", {name: user.name}));
    this.render();
  }

  static async #onExperienced(event, target) {
    const user = OverviewApp.#userOf(target);
    if ( !user ) return;
    if ( progressOf(user).status === STATUS.EXPERIENCED ) await resetUser(user);
    else await saveProgress(experiencedProgress(progressOf(user), Date.now()), user);
    this.render();
  }

  static async #onReset(event, target) {
    const user = OverviewApp.#userOf(target);
    if ( !user ) return;
    await resetUser(user);
    this.render();
  }

  static async #onAllExperienced() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: {title: t("SFT.Overview.allExperienced")},
      content: `<p>${t("SFT.Overview.allExperiencedAsk")}</p>`,
      yes: {label: t("SFT.Overview.allExperiencedYes")},
      no: {label: t("SFT.Overview.cancel")}
    });
    if ( !ok ) return;
    for ( const user of game.users.filter(u => !u.isGM) ) {
      if ( !progressOf(user).status ) await saveProgress(experiencedProgress(progressOf(user), Date.now()), user);
    }
    this.render();
  }

  static #onPreview() {
    this.close();
    countFeature(MODULE_ID, "previewStarted");
    startTour({preview: true});
  }
}

/**
 * Open the overview.
 * @returns {Promise<OverviewApp>}
 */
export async function openOverview() {
  if ( !game.user.isGM ) return null;
  const existing = foundry.applications.instances.get(OVERVIEW_ID);
  const app = existing ?? new OverviewApp();
  await app.render({force: true});
  countFeature(MODULE_ID, "overviewOpened");
  return app;
}

/**
 * The steps changed (maybe at another GM's screen): tick the boxes as the world says, without drawing the window again,
 * so a click in the next moment is not lost.
 */
export function syncSteps() {
  const app = foundry.applications.instances.get(OVERVIEW_ID);
  if ( !isShown(app) || !app.element ) return;
  const offered = offeredSteps(setting("steps"));
  for ( const box of app.element.querySelectorAll("input[data-step]") ) box.checked = offered.includes(box.dataset.step);
}

/** Draw the overview again when it is open and something about the players changed. */
export function refreshOverview() {
  const app = foundry.applications.instances.get(OVERVIEW_ID);
  if ( isShown(app) ) app.render();
}

