/**
 * The made-up data of the sample windows: progress records of the table's players (Lena, Tom, Sam and Jo) and the cards
 * of a chapter. Pure functions over tour-logic.mjs, nothing here reads or writes the world.
 */

import {CHAPTERS, CHAPTER_IDS, STATUS, STEP_DEFS, STEP_IDS, chapterSteps, experiencedProgress, finishProgress, laterProgress,
  markStep, startProgress, stopProgress} from "./tour-logic.mjs";

/** The moment all sample progress happened at (the windows show no dates, the value only has to be a number). */
const NOW = 1_700_000_000_000;

/**
 * A progress record: the chapters in order, the last one running.
 * @param {object} options
 * @param {string[]} [options.finished]   Chapters finished completely
 * @param {string} [options.running]      The chapter in progress
 * @param {number} [options.done]         Steps of the running chapter done
 * @param {number} [options.skipped]      Steps of the running chapter skipped after those
 * @param {"running"|"stopped"|"finished"} [options.end]   How the record ends (running by default)
 * @returns {object}
 */
export function progressWith({finished = [], running = "", done = 0, skipped = 0, end = "running"} = {}) {
  let p = {};
  for ( const id of finished ) {
    p = startProgress(p, NOW, {chapter: id});
    for ( const step of chapterSteps(id) ) p = markStep(p, step, "done", NOW);
    p = finishProgress(p, NOW, id);
  }
  if ( !running ) return p;
  p = startProgress(p, NOW, {chapter: running});
  const steps = chapterSteps(running);
  steps.slice(0, done).forEach(id => { p = markStep(p, id, "done", NOW); });
  steps.slice(done, done + skipped).forEach(id => { p = markStep(p, id, "skipped", NOW); });
  if ( end === "stopped" ) return stopProgress(p, NOW);
  if ( end === "finished" ) return finishProgress(p, NOW, running);
  return p;
}

/**
 * The players of the table at different points of the tour, for the GM's overview. The names follow the shared sample cast.
 * @param {"mixed"|"more"} kind
 * @returns {{id: string, name: string, color: string, active: boolean, character: string, progress: object}[]}
 */
export function sampleRows(kind = "mixed") {
  const rows = {
    mixed: [
      ["lena", "Lena", "Ari", true, progressWith({finished: ["basics"], running: "sidebar", done: 6, skipped: 1})],
      ["tom", "Tom", "Mira", true, progressWith({finished: CHAPTER_IDS.slice(0, 6)})],
      ["sam", "Sam", "Tovin", false, experiencedProgress({}, NOW)],
      ["jo", "Jo", "Sela", true, {}]
    ],
    more: [
      ["lena", "Lena", "Ari", true, progressWith({running: "basics", done: 3, end: "stopped"})],
      ["tom", "Tom", "Mira", false, laterProgress({}, NOW)],
      ["sam", "Sam", "Tovin", true, progressWith({finished: CHAPTER_IDS})],
      ["jo", "Jo", "Sela", true, progressWith({finished: ["basics", "sidebar"], running: "fight", done: 4, skipped: 1})]
    ]
  }[kind] ?? [];
  const colors = {lena: "#e0674f", tom: "#4f8ee0", sam: "#58b368", jo: "#d9a441"};
  return rows.map(([id, name, character, active, progress]) => ({id: `sample-${id}`, name, color: colors[id], active, character,
    progress}));
}

/**
 * The steps of a chapter as cards would show them, in order. A step that waits for something the player may not have
 * gets the note why, but only the first step of the whole tour that waits for it: a note on every card would be noise.
 * @param {string} chapterId
 * @returns {{id: string, done: number, total: number, missing: string[]}[]}
 */
export function chapterCards(chapterId) {
  const steps = chapterSteps(chapterId);
  const first = new Map();
  for ( const id of STEP_IDS ) {
    for ( const need of STEP_DEFS[id].needs ) if ( (need !== "character") && !first.has(need) ) first.set(need, id);
  }
  return steps.map((id, index) => {
    const need = STEP_DEFS[id].needs.find(n => (n !== "character") && (first.get(n) === id));
    return {id, done: index, total: steps.length, missing: need ? [need] : []};
  });
}

/** The ids of the chapters (for the entries of the sample list). */
export const SAMPLE_CHAPTERS = CHAPTERS.map(chapter => chapter.id);

export const __test__ = {NOW, STATUS};
