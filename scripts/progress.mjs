/**
 * Where the progress of a player's tour lives: three flags on the player's own user document, "progress", "invite" and
 * "inviteChapter" (the chapter the GM's invitation names).
 * A player may write the flags of their own user, the GM may write all of them. Nothing is stored in the world's
 * documents, and nothing in the actors, scenes or the chat.
 */

import {MODULE_ID, userFlags} from "./config.mjs";
import {cleanProgress, inviteChapter, storedProgress} from "./tour-logic.mjs";

/** Writes go one after the other, so a quick sequence of steps never overtakes itself. */
let queue = Promise.resolve();

/**
 * The progress of a user.
 * @param {User} [user]
 * @returns {object}
 */
export function progressOf(user = game.user) {
  return cleanProgress(userFlags(user).progress);
}

/**
 * When the GM started the tour for a user (0 for never).
 * @param {User} [user]
 * @returns {number}
 */
export function inviteOf(user = game.user) {
  const value = userFlags(user).invite;
  return (Number.isFinite(value) && (value > 0)) ? value : 0;
}

/**
 * The chapter the GM's invitation of a user names (the first chapter when none is named).
 * @param {User} [user]
 * @returns {string}
 */
export function inviteChapterOf(user = game.user) {
  return inviteChapter(userFlags(user).inviteChapter);
}

/**
 * Store the progress of a user.
 * @param {object} progress
 * @param {User} [user]
 * @returns {Promise<void>}
 */
export function saveProgress(progress, user = game.user) {
  const data = {[`flags.${MODULE_ID}.progress`]: storedProgress(progress)};
  queue = queue.then(() => user.update(data)).then(() => undefined).catch(err => {
    console.warn(`${MODULE_ID} | Could not store the progress of ${user.name}`, err);
  });
  return queue;
}

/**
 * Offer a chapter to a player (GM): the player is asked at the next chance, never interrupted.
 * @param {User} user
 * @param {string} [chapter]   The chapter, the first one by default
 * @returns {Promise<void>}
 */
export function inviteUser(user, chapter) {
  const data = {[`flags.${MODULE_ID}.invite`]: Date.now(), [`flags.${MODULE_ID}.inviteChapter`]: inviteChapter(chapter)};
  queue = queue.then(() => user.update(data)).then(() => undefined).catch(err => {
    console.warn(`${MODULE_ID} | Could not invite ${user.name}`, err);
  });
  return queue;
}

/**
 * Remove everything the module stored on a user (GM): the player is new to the tour again.
 * @param {User} user
 * @returns {Promise<void>}
 */
export function resetUser(user) {
  const ForcedDeletion = foundry.data?.operators?.ForcedDeletion;
  const remove = ForcedDeletion ? new ForcedDeletion() : null;
  const data = remove ? {[`flags.${MODULE_ID}`]: remove} : {[`flags.-=${MODULE_ID}`]: null};
  queue = queue.then(() => user.update(data)).then(() => undefined).catch(err => {
    console.warn(`${MODULE_ID} | Could not reset ${user.name}`, err);
  });
  return queue;
}

/**
 * Does an update of a user touch what this module stores? The flags may be changed, or removed with a deletion.
 * @param {object} changes   The changes of an updateUser hook
 * @returns {boolean}
 */
export function touchesFlags(changes) {
  const flags = changes?.flags;
  return !!flags && ((MODULE_ID in flags) || (`-=${MODULE_ID}` in flags));
}
