import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {CHAPTER_IDS, STEP_DEFS, STEP_IDS, TIP_IDS} from "../scripts/tour-logic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const en = JSON.parse(await readFile(path.join(root, "lang/en.json"), "utf8"));
const de = JSON.parse(await readFile(path.join(root, "lang/de.json"), "utf8"));

/** All texts of a nested object. */
function texts(object) {
  return Object.values(object).flatMap(value => ((value && (typeof value === "object")) ? texts(value) : [String(value)]));
}

test("public texts use no dashes or hyphens as punctuation", () => {
  for ( const text of [...texts(en), ...texts(de)] ) {
    // "Debug-Datei" is the same word in every Sephral module
    const plain = text.replace(/\{\w+\}/g, "").replace(/Debug-Datei/g, "");
    assert.ok(!/[–—]/.test(plain), text);
    assert.ok(!/ - /.test(plain), text);
    assert.ok(!/[A-Za-zÄÖÜäöüß]-[A-Za-zÄÖÜäöüß]/.test(plain), text);
  }
});

test("every step has its texts in both languages", () => {
  for ( const id of STEP_IDS ) {
    for ( const part of ["title", "text", "do"] ) {
      assert.equal(typeof en.SFT.STEPS[id][part], "string", `${id}.${part}`);
      assert.equal(typeof de.SFT.STEPS[id][part], "string", `${id}.${part}`);
    }
  }
});

test("the first chapter keeps its done line for every step", () => {
  for ( const id of ["sheet", "roll", "moveKeys", "moveDrag", "target", "ping", "measure", "chat", "whisper", "journal"] ) {
    assert.equal(typeof en.SFT.STEPS[id].done, "string", id);
    assert.equal(typeof de.SFT.STEPS[id].done, "string", id);
  }
});

test("every chapter and every tip has its texts", () => {
  for ( const id of CHAPTER_IDS ) {
    assert.equal(typeof en.SFT.CHAPTERS[id].title, "string", id);
    assert.equal(typeof de.SFT.CHAPTERS[id].title, "string", id);
  }
  for ( const id of TIP_IDS ) for ( const part of ["title", "text"] ) {
    assert.equal(typeof en.SFT.TIPS[id][part], "string", id);
    assert.equal(typeof de.SFT.TIPS[id][part], "string", id);
  }
});

test("a step that can be marked as seen says so in its instruction", () => {
  for ( const id of STEP_IDS.filter(step => STEP_DEFS[step].look) ) {
    assert.match(en.SFT.STEPS[id].do, /seen|click|Nothing|Hold/i, id);
    assert.ok(de.SFT.STEPS[id].do.length > 10, id);
  }
});

test("texts of the steps are short and plain", () => {
  for ( const id of STEP_IDS ) {
    for ( const part of ["title", "text", "do"] ) {
      assert.ok(en.SFT.STEPS[id][part].length <= 330, `${id}.${part} en ${en.SFT.STEPS[id][part].length}`);
      assert.ok(de.SFT.STEPS[id][part].length <= 360, `${id}.${part} de ${de.SFT.STEPS[id][part].length}`);
    }
  }
});

test("system variants exist in both languages", () => {
  for ( const lang of [en, de] ) {
    for ( const id of STEP_IDS ) for ( const key of Object.keys(lang.SFT.STEPS[id]) ) {
      assert.match(key, /^(title|text|do|done)(V\d+|Dnd5e|Pf2e|Swade|Crucible)?$/, `${id}.${key}`);
    }
  }
});

test("the roll step has a text for every system it names", () => {
  for ( const system of ["Dnd5e", "Pf2e", "Swade", "Crucible"] ) {
    assert.equal(typeof en.SFT.STEPS.roll[`do${system}`], "string", system);
    assert.equal(typeof de.SFT.STEPS.roll[`do${system}`], "string", system);
  }
});

test("no text names another module", () => {
  for ( const text of [...texts(en), ...texts(de)] ) assert.ok(!/Dice So Nice|Better Rolltables|Item Piles|Pin Cushion/i.test(text), text);
});

test("every reason a step can wait has a text", () => {
  const needs = new Set(STEP_IDS.flatMap(id => STEP_DEFS[id].needs).filter(need => need !== "character"));
  for ( const need of needs ) {
    assert.equal(typeof en.SFT.missing[need], "string", need);
    assert.equal(typeof de.SFT.missing[need], "string", need);
  }
});
