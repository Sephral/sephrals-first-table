/**
 * Settings of the module. Like in every Sephral module, all options appear in Foundry's settings dialog under this
 * module, starting with the module language.
 */

import {MODULE_ID, isShown} from "./config.mjs";
import {FOLLOW_FOUNDRY, applyModuleLanguage} from "./language.mjs";
import {runSelfTest} from "./selftest.mjs";

/**
 * The settings of the module, in the order they appear in the settings dialog.
 * @type {Record<string, object>}
 */
export const SETTINGS = {
  uiLanguage: {type: String, default: FOLLOW_FOUNDRY, scope: "client", onChange: "language", choices: {
    [FOLLOW_FOUNDRY]: "SFT.LANGUAGE.default", de: "SFT.LANGUAGE.de", en: "SFT.LANGUAGE.en"}},
  theme: {type: String, default: "signature", scope: "client", onChange: "redraw", choices: {
    signature: "SFT.SETTINGS.theme.signature", foundry: "SFT.SETTINGS.theme.foundry"}},
  offer: {type: String, default: "auto", choices: {
    auto: "SFT.SETTINGS.offer.auto", gm: "SFT.SETTINGS.offer.gm", off: "SFT.SETTINGS.offer.off"}},
  helpButton: {type: Boolean, default: true, scope: "client", onChange: "helpButton"}
};

/** The functions the menus call, set by registerSettings. */
let menuHandlers = {};

/**
 * Register all settings of the module and its menus.
 * @param {object} handlers   {language, redraw, helpButton, steps, openOverview, startTour}
 */
export function registerSettings(handlers) {
  menuHandlers = handlers;
  for ( const [key, def] of Object.entries(SETTINGS) ) {
    game.settings.register(MODULE_ID, key, {
      name: `SFT.SETTINGS.${key}.name`,
      hint: `SFT.SETTINGS.${key}.hint`,
      scope: def.scope ?? "world",
      config: true,
      type: def.type,
      choices: def.choices,
      default: def.default,
      requiresReload: false,
      onChange: def.onChange ? value => handlers[def.onChange]?.(value) : undefined
    });
  }

  // Data of the module: the steps the GM turned off, whether the world was looked at once, where the player put the card
  game.settings.register(MODULE_ID, "steps", {scope: "world", config: false, type: Object, default: {disabled: []},
    onChange: value => handlers.steps?.(value)});
  game.settings.register(MODULE_ID, "baselined", {scope: "world", config: false, type: Boolean, default: false});
  game.settings.register(MODULE_ID, "cardPlace", {scope: "client", config: false, type: Object, default: {}});
  game.settings.register(MODULE_ID, "acknowledgedVersions", {scope: "client", config: false, type: String, default: ""});

  // The module's own menus first, then the self test (the debug file comes after, registered by registerDebug)
  game.settings.registerMenu(MODULE_ID, "overview", {
    name: "SFT.Overview.title",
    label: "SFT.Overview.open",
    hint: "SFT.Overview.menuHint",
    icon: "fa-solid fa-users-viewfinder",
    type: OverviewMenu,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "tour", {
    name: "SFT.TourMenu.title",
    label: "SFT.TourMenu.open",
    hint: "SFT.TourMenu.hint",
    icon: "fa-solid fa-compass",
    type: TourMenu,
    restricted: false
  });
  game.settings.registerMenu(MODULE_ID, "selfTest", {
    name: "SFT.SELFTEST.Title",
    label: "SFT.SELFTEST.Run",
    hint: "SFT.SELFTEST.Hint",
    icon: "fa-solid fa-stethoscope",
    type: SelfTestMenu,
    restricted: true
  });
}

/** The menu button which opens the GM's overview. Foundry only accepts application classes as menus. */
class OverviewMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    await menuHandlers.openOverview?.();
    return this;
  }
}

/** The menu button which opens the tour for this player. */
class TourMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    menuHandlers.startTour?.();
    return this;
  }
}

/** The menu button which runs the self test. */
class SelfTestMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    if ( game.user.isGM ) await runSelfTest();
    return this;
  }
}

/**
 * Switch the module strings when the user picks another module language, then redraw.
 * @param {string} value
 * @param {Function} redraw
 */
export function changeLanguage(value, redraw) {
  applyModuleLanguage(value).then(() => {
    const overview = foundry.applications.instances.get("sft-overview");
    if ( isShown(overview) ) overview.render({window: {title: overview.title}});
    redraw();
    if ( game.settings.sheet?.rendered ) game.settings.sheet.render();
  });
}
