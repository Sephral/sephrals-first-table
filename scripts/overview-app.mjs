/**
 * The GM's overview: how far each player is in every chapter, offer a chapter to a player, mark players as experienced and
 * choose which chapters and steps are offered. Opens only when the GM asks, never on its own.
 */

import {MODULE_ID, TEMPLATES, addSettingsGear, isShown, setting, t} from "./config.mjs";
import {inviteUser, progressOf, resetUser, saveProgress} from "./progress.mjs";
import {CHAPTERS, CHAPTER_IDS, STATUS, STEP_DEFS, experiencedProgress, chaptersSetting, offeredChapters, offeredSteps,
  permissiveContext, playerSummary, stepsSetting} from "./tour-logic.mjs";
import {help as openGuide} from "./tour.mjs";
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
  /** The chapters whose steps the GM opened, so a redraw does not close them. */
  #open = new Set();

  /** @override */
  static DEFAULT_OPTIONS = {
    id: OVERVIEW_ID,
    classes: ["sft-app", "sft-overview"],
    tag: "section",
    window: {title: "SFT.Overview.title", icon: "fa-solid fa-users-viewfinder", resizable: true},
    position: {width: 640, height: "auto"},
    actions: {
      invite: OverviewApp.#onInvite,
      inviteChapter: OverviewApp.#onInviteChapter,
      experienced: OverviewApp.#onExperienced,
      reset: OverviewApp.#onReset,
      allExperienced: OverviewApp.#onAllExperienced,
      preview: OverviewApp.#onPreview
    }
  };

  /** @override */
  static PARTS = {main: {template: `${TEMPLATES}/overview.hbs`, scrollable: [".sft-scroll"]}};

  /** @override */
  get title() {
    return t("SFT.Overview.title");
  }

  /**
   * The players of the table with their progress. A sample window gives made-up ones instead.
   * @returns {{user: {id: string, name: string, color: string, active: boolean, character: string}, progress: object}[]}
   */
  _rows() {
    return game.users.filter(user => !user.isGM).map(user => ({
      user: {id: user.id, name: user.name, color: user.color?.css ?? user.color ?? "#888888", active: user.active,
        character: characterOf(user)?.name ?? ""},
      progress: progressOf(user)
    }));
  }

  /** Who is offered the tour on its own: "auto", "gm" or "off". */
  _mode() {
    return setting("offer");
  }

  /** @override */
  async _prepareContext() {
    const offered = offeredSteps(setting("steps"));
    const chapters = offeredChapters(setting("chapters"));
    const ctx = permissiveContext(game.system.id);
    const players = this._rows().map(({user, progress}) => {
      const summary = playerSummary(progress, {offered, chapters, ctx: {...ctx, character: !!user.character}});
      const status = summary.status;
      return {
        id: user.id,
        name: user.name,
        color: user.color?.css ?? user.color ?? "#888888",
        active: user.active,
        character: user.character ?? "",
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
        counts: t("SFT.Overview.counts", {done: summary.chaptersDone, total: summary.chaptersTotal}),
        chapters: summary.chapters.map(c => ({id: c.id, icon: CHAPTERS.find(ch => ch.id === c.id).icon, state: c.state,
          title: t(`SFT.CHAPTERS.${c.id}.title`), meta: c.finished ? t("SFT.Overview.chapterDone")
            : (c.total ? t("SFT.Overview.chapterCount", {done: c.done + c.skipped, total: c.total}) : t("SFT.Overview.chapterNone")),
          tooltip: t("SFT.Overview.offerChapter", {chapter: t(`SFT.CHAPTERS.${c.id}.title`)})}))
      };
    });
    const mode = this._mode();
    return {
      theme: setting("theme"),
      players,
      noPlayers: !players.length,
      groups: CHAPTERS.map(chapter => ({id: chapter.id, icon: chapter.icon, title: t(`SFT.CHAPTERS.${chapter.id}.title`),
        offered: chapters.includes(chapter.id), steps: chapter.steps.map(id => ({id, icon: STEP_DEFS[id].icon,
          title: t(`SFT.STEPS.${id}.title`), offered: offered.includes(id)}))})),
      modeText: t(`SFT.Overview.mode.${mode}`),
      text: {
        hint: t("SFT.Overview.hint"),
        players: t("SFT.Overview.players"),
        noPlayers: t("SFT.Overview.noPlayers"),
        steps: t("SFT.Overview.steps"),
        stepsHint: t("SFT.Overview.stepsHint"),
        chapterOn: t("SFT.Overview.chapterOn"),
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
    for ( const box of this.element.querySelectorAll("input[data-chapter]") ) {
      box.addEventListener("change", () => this.#saveChapters());
    }
    for ( const group of this.element.querySelectorAll("details[data-group]") ) {
      group.open = this.#open.has(group.dataset.group);
      group.addEventListener("toggle", () => {
        if ( group.open ) this.#open.add(group.dataset.group);
        else this.#open.delete(group.dataset.group);
      });
    }
  }

  /** The GM ticked or unticked a step. */
  async #saveSteps() {
    if ( this.isSample ) return;
    const offered = [...this.element.querySelectorAll("input[data-step]")].filter(box => box.checked)
      .map(box => box.dataset.step);
    await game.settings.set(MODULE_ID, "steps", stepsSetting(offered));
    countFeature(MODULE_ID, "stepsChanged");
    trace.add("stepsChanged", {offered});
  }

  /** The GM ticked or unticked a chapter. */
  async #saveChapters() {
    if ( this.isSample ) return;
    const offered = [...this.element.querySelectorAll("input[data-chapter]")].filter(box => box.checked)
      .map(box => box.dataset.chapter);
    await game.settings.set(MODULE_ID, "chapters", chaptersSetting(offered));
    countFeature(MODULE_ID, "chaptersChanged");
    trace.add("chaptersChanged", {offered});
  }

  /** The user of a button's row. */
  static #userOf(target) {
    return game.users.get(target.closest("[data-user-id]")?.dataset.userId);
  }

  static async #onInvite(event, target) {
    const user = OverviewApp.#userOf(target);
    if ( !user ) return;
    const chapter = offeredChapters(setting("chapters"))[0] ?? CHAPTER_IDS[0];
    await inviteUser(user, chapter);
    countFeature(MODULE_ID, "startedForPlayer");
    trace.add("invited", {chapter});
    ui.notifications.info(t("SFT.Overview.invited", {name: user.name}));
    this.render();
  }

  static async #onInviteChapter(event, target) {
    const user = OverviewApp.#userOf(target);
    const chapter = target.closest("[data-chapter]")?.dataset.chapter;
    if ( !user || !CHAPTER_IDS.includes(chapter) ) return;
    await inviteUser(user, chapter);
    countFeature(MODULE_ID, "chapterOffered");
    trace.add("chapterOffered", {chapter});
    ui.notifications.info(t("SFT.Overview.invitedChapter", {name: user.name, chapter: t(`SFT.CHAPTERS.${chapter}.title`)}));
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
    openGuide();
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
  const chapters = offeredChapters(setting("chapters"));
  for ( const box of app.element.querySelectorAll("input[data-chapter]") ) box.checked = chapters.includes(box.dataset.chapter);
}

/** Draw the overview again when it is open and something about the players changed. */
export function refreshOverview() {
  const app = foundry.applications.instances.get(OVERVIEW_ID);
  if ( isShown(app) ) app.render();
}

