/**
 * First Table's part of the debug file of Sephral's modules, without names or personal texts.
 */

import {MODULE_ID, setting, t} from "./config.mjs";
import {registerDebugMenu, registerDebugProvider} from "./debug-file.mjs";
import {inviteOf, progressOf} from "./progress.mjs";
import {context, describe, offered, offeredChapterIds} from "./tour.mjs";
import {trace} from "./trace.mjs";

/**
 * What the module knows right now.
 * @returns {object}
 */
export function describeState() {
  const players = game.users.filter(user => !user.isGM);
  const statuses = {};
  for ( const user of players ) {
    const status = progressOf(user).status || "new";
    statuses[status] = (statuses[status] ?? 0) + 1;
  }
  return {
    foundry: game.version,
    system: `${game.system.id} ${game.system.version}`,
    tour: describe(),
    ownInvite: inviteOf(),
    offered: offered(),
    chapters: offeredChapterIds(),
    context: context(),
    players: {count: players.length, byStatus: statuses},
    settings: Object.fromEntries(["offer", "helpButton", "theme", "uiLanguage", "tips"].map(key => [key, setting(key)])),
    activeGM: !!game.users?.activeGM
  };
}

/**
 * The button in the settings and the module's part of the file. Call in "init".
 */
export function registerDebug() {
  registerDebugMenu(MODULE_ID, {name: "SFT.DEBUG.Title", label: "SFT.DEBUG.Save", hint: "SFT.DEBUG.Hint"});
  registerDebugProvider({
    moduleId: MODULE_ID,
    label: () => t("SFT.DEBUG.Entry"),
    notice: file => t("SFT.DEBUG.Saved", {file}),
    recent: () => ({details: describeState()}),
    trace
  });
}
