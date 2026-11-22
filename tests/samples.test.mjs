import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {SAMPLE_CHAPTERS, chapterCards, progressWith, sampleRows} from "../scripts/sample-data.mjs";
import {CHAPTER_IDS, STATUS, STEP_DEFS, STEP_IDS, cleanProgress, playerSummary, permissiveContext} from "../scripts/tour-logic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the sample players show every status of the overview between the two sets", () => {
  const statuses = new Set([...sampleRows("mixed"), ...sampleRows("more")].map(r => cleanProgress(r.progress).status || "new"));
  for ( const status of ["new", STATUS.RUNNING, STATUS.FINISHED, STATUS.STOPPED, STATUS.EXPERIENCED, STATUS.LATER] ) {
    assert.ok(statuses.has(status), status);
  }
});

test("the sample players are the shared cast's players and are not real users", () => {
  const names = sampleRows("mixed").map(r => r.name);
  assert.deepEqual(names, ["Lena", "Tom", "Sam", "Jo"]);
  assert.ok(sampleRows("mixed").every(r => r.id.startsWith("sample-")));
  assert.deepEqual(sampleRows("none"), []);
});

test("progressWith finishes chapters and leaves the running one part done", () => {
  const p = cleanProgress(progressWith({finished: ["basics"], running: "sidebar", done: 3, skipped: 1}));
  assert.equal(p.status, STATUS.RUNNING);
  assert.deepEqual(p.chapters, ["basics"]);
  assert.equal(Object.values(p.steps).filter(s => s === "skipped").length, 1);
  assert.equal(p.steps.sbChat, "done");
  const summary = playerSummary(p, {offered: STEP_IDS, ctx: permissiveContext("dnd5e")});
  assert.ok(summary.percent > 0 && summary.percent < 100);
});

test("every chapter has a card per step and the first waiting step of each need carries the note", () => {
  const noted = new Map();
  for ( const chapter of SAMPLE_CHAPTERS ) {
    const cards = chapterCards(chapter);
    assert.ok(cards.length > 0);
    cards.forEach((card, i) => {
      assert.equal(card.done, i);
      assert.equal(card.total, cards.length);
      for ( const need of card.missing ) noted.set(need, card.id);
    });
  }
  const needs = new Set(STEP_IDS.flatMap(id => STEP_DEFS[id].needs).filter(n => n !== "character"));
  assert.deepEqual([...noted.keys()].sort(), [...needs].sort());
  assert.deepEqual(SAMPLE_CHAPTERS, CHAPTER_IDS);
});

test("every waiting note has a text in both languages and the sample keys match", async () => {
  const needs = new Set(STEP_IDS.flatMap(id => STEP_DEFS[id].needs).filter(n => n !== "character"));
  for ( const lang of ["en", "de"] ) {
    const json = JSON.parse(await readFile(path.join(root, "lang", `${lang}.json`), "utf8")).SFT;
    for ( const need of needs ) assert.ok(json.missing[need], `${lang} missing.${need}`);
  }
  const en = JSON.parse(await readFile(path.join(root, "lang/en.json"), "utf8")).SFT.Sample;
  const de = JSON.parse(await readFile(path.join(root, "lang/de.json"), "utf8")).SFT.Sample;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
});

test("the overview never saves from a sample window", async () => {
  const source = await readFile(path.join(root, "scripts/overview-app.mjs"), "utf8");
  assert.match(source, /async #saveSteps\(\) \{\s+if \( this\.isSample \) return;/);
  assert.match(source, /async #saveChapters\(\) \{\s+if \( this\.isSample \) return;/);
});
