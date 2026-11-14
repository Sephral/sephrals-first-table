import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {STEP_IDS} from "../scripts/tour-logic.mjs";

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

test("every step has its four texts in both languages", () => {
  for ( const id of STEP_IDS ) {
    for ( const part of ["title", "text", "do", "done"] ) {
      assert.equal(typeof en.SFT.STEPS[id][part], "string", `${id}.${part}`);
      assert.equal(typeof de.SFT.STEPS[id][part], "string", `${id}.${part}`);
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
