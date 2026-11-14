import assert from "node:assert/strict";
import {test} from "node:test";
import {DRAG_WINDOW, KEY_WINDOW, MAX_OFFERS, STATUS, STEP_DEFS, STEP_IDS, chatEvents, classifyMove, cleanProgress, completes,
  counts, currentStep, doKey, experiencedProgress, finishProgress, isEstablished, isMeasuring, isOwnPing, laterProgress,
  markStep, offerKind, offeredSteps, planSteps, playerSummary, progressDelta, startProgress, stepsSetting, stopProgress,
  storedProgress} from "../scripts/tour-logic.mjs";

const ALL = {character: true, ownToken: true, otherToken: true, canvas: true};

test("every step has an event, needs and an icon", () => {
  for ( const id of STEP_IDS ) {
    assert.ok(STEP_DEFS[id].event, id);
    assert.ok(Array.isArray(STEP_DEFS[id].needs), id);
    assert.ok(STEP_DEFS[id].icon.startsWith("fa-"), id);
  }
  assert.equal(new Set(STEP_IDS.map(id => STEP_DEFS[id].event)).size, STEP_IDS.length);
});

test("progress is cleaned and keeps only known steps", () => {
  const p = cleanProgress({status: "running", steps: {sheet: "done", nonsense: "done", roll: "maybe", ping: "skipped"},
    started: 5, offers: 1.7, handledInvite: -3});
  assert.deepEqual(p.steps, {sheet: "done", ping: "skipped"});
  assert.equal(p.status, "running");
  assert.equal(p.offers, 1);
  assert.equal(p.handledInvite, 0);
  assert.equal(cleanProgress(null).status, "");
  assert.equal(cleanProgress({status: "weird"}).status, "");
});

test("the stored form uses lists and round trips", () => {
  let p = startProgress({}, 10);
  p = markStep(p, "roll", "done", 11);
  p = markStep(p, "sheet", "skipped", 12);
  const stored = storedProgress(p);
  assert.deepEqual(stored.done, ["roll"]);
  assert.deepEqual(stored.skipped, ["sheet"]);
  assert.equal("steps" in stored, false);
  assert.deepEqual(cleanProgress(stored).steps, {roll: "done", sheet: "skipped"});
});

test("starting, stopping and finishing", () => {
  let p = startProgress({}, 100);
  assert.equal(p.status, STATUS.RUNNING);
  assert.equal(p.started, 100);
  p = markStep(p, "sheet", "done", 101);
  p = stopProgress(p, 102);
  assert.equal(p.status, STATUS.STOPPED);
  assert.deepEqual(p.steps, {sheet: "done"});
  // Going on keeps the steps and the start, starting over forgets them
  assert.deepEqual(startProgress(p, 200).steps, {sheet: "done"});
  assert.equal(startProgress(p, 200).started, 100);
  assert.deepEqual(startProgress(p, 200, {restart: true}).steps, {});
  assert.equal(startProgress(p, 200, {restart: true}).started, 200);
  const done = finishProgress(p, 300);
  assert.equal(done.status, STATUS.FINISHED);
  assert.equal(done.finished, 300);
  // A finished tour starts fresh
  assert.deepEqual(startProgress(done, 400).steps, {});
  assert.equal(startProgress(done, 400).finished, 0);
  assert.deepEqual(markStep(p, "nope", "done", 1).steps, {sheet: "done"});
});

test("not now asks again once, then stops asking", () => {
  const first = laterProgress({}, 1);
  assert.equal(first.status, STATUS.LATER);
  assert.equal(first.offers, 1);
  const second = laterProgress(first, 2);
  assert.equal(second.offers, MAX_OFFERS);
  assert.equal(second.status, STATUS.STOPPED);
  assert.equal(experiencedProgress({}, 3).status, STATUS.EXPERIENCED);
});

test("what a player is offered", () => {
  const base = {mode: "auto", isGM: false};
  assert.equal(offerKind({...base, progress: {}}), "offer");
  assert.equal(offerKind({...base, progress: {status: "later", offers: 1}}), "offer");
  assert.equal(offerKind({...base, progress: {status: "running"}}), "resume");
  assert.equal(offerKind({...base, progress: {status: "finished"}}), null);
  assert.equal(offerKind({...base, progress: {status: "stopped"}}), null);
  assert.equal(offerKind({...base, progress: {status: "experienced"}}), null);
  assert.equal(offerKind({...base, progress: {}, isGM: true}), null);
  // The GM's mode: nothing on its own, but a started tour still resumes
  assert.equal(offerKind({mode: "gm", isGM: false, progress: {}}), null);
  assert.equal(offerKind({mode: "off", isGM: false, progress: {}}), null);
  assert.equal(offerKind({mode: "gm", isGM: false, progress: {status: "running"}}), "resume");
});

test("an invitation is offered once, and again for a newer one", () => {
  const base = {mode: "off", isGM: false};
  assert.equal(offerKind({...base, progress: {}, invite: 50}), "invited");
  assert.equal(offerKind({...base, progress: {status: "finished"}, invite: 50}), "invited");
  assert.equal(offerKind({...base, progress: {status: "experienced"}, invite: 50}), "invited");
  assert.equal(offerKind({...base, progress: {handledInvite: 50}, invite: 50}), null);
  assert.equal(offerKind({...base, progress: {handledInvite: 50}, invite: 80}), "invited");
  assert.equal(offerKind({...base, progress: {status: "running", handledInvite: 10}, invite: 50}), "resume");
});

test("a world in use does not offer the tour on its own", () => {
  assert.equal(isEstablished({messages: 0, combats: 0}), false);
  assert.equal(isEstablished({messages: 29, combats: 0}), false);
  assert.equal(isEstablished({messages: 30, combats: 0}), true);
  assert.equal(isEstablished({messages: 2, combats: 1}), true);
  assert.equal(isEstablished(), false);
});

test("the plan drops character steps without a character and marks what is missing", () => {
  const none = planSteps({offered: STEP_IDS, progress: {}, ctx: {...ALL, character: false}});
  assert.deepEqual(none.map(s => s.id), STEP_IDS.filter(id => !STEP_DEFS[id].needs.includes("character")));
  const noToken = planSteps({offered: STEP_IDS, progress: {}, ctx: {...ALL, ownToken: false, otherToken: false}});
  assert.deepEqual(noToken.find(s => s.id === "moveKeys").missing, ["ownToken"]);
  assert.deepEqual(noToken.find(s => s.id === "target").missing, ["otherToken"]);
  assert.deepEqual(noToken.find(s => s.id === "chat").missing, []);
  assert.deepEqual(noToken.find(s => s.id === "sheet").missing, []);
});

test("the plan follows the steps the GM offers and the progress", () => {
  const offered = ["sheet", "ping", "chat"];
  let progress = {};
  let plan = planSteps({offered, progress, ctx: ALL});
  assert.deepEqual(plan.map(s => s.id), ["sheet", "ping", "chat"]);
  assert.equal(currentStep(plan).id, "sheet");
  progress = markStep(markStep(progress, "sheet", "done", 1), "ping", "skipped", 2);
  plan = planSteps({offered, progress, ctx: ALL});
  assert.equal(currentStep(plan).id, "chat");
  assert.deepEqual(counts(plan), {total: 3, done: 1, skipped: 1, left: 1});
  progress = markStep(progress, "chat", "done", 3);
  assert.equal(currentStep(planSteps({offered, progress, ctx: ALL})), null);
  // A step turned off after it was done does not count
  assert.equal(counts(planSteps({offered: ["ping", "chat"], progress, ctx: ALL})).total, 2);
});

test("the offered steps round trip through the setting", () => {
  assert.deepEqual(offeredSteps(undefined), STEP_IDS);
  assert.deepEqual(offeredSteps({disabled: ["ping", "unknown"]}), STEP_IDS.filter(id => id !== "ping"));
  assert.deepEqual(stepsSetting(STEP_IDS.filter(id => id !== "ping")), {disabled: ["ping"]});
  assert.deepEqual(offeredSteps(stepsSetting(["chat", "sheet"])), ["sheet", "chat"]);
});

test("an event completes only its own step", () => {
  assert.equal(completes("moveKeys", "move:keys"), true);
  assert.equal(completes("moveKeys", "move:drag"), false);
  assert.equal(completes("moveDrag", "move:drag"), true);
  assert.equal(completes("chat", "whisper"), false);
  assert.equal(completes("nope", "chat"), false);
});

test("a step's instruction follows the game system when it has a text", () => {
  const has = key => ["SFT.STEPS.roll.doDnd5e", "SFT.STEPS.roll.doPf2e"].includes(key);
  assert.equal(doKey("roll", "dnd5e", has), "SFT.STEPS.roll.doDnd5e");
  assert.equal(doKey("roll", "pf2e", has), "SFT.STEPS.roll.doPf2e");
  assert.equal(doKey("roll", "swade", has), "SFT.STEPS.roll.do");
  assert.equal(doKey("roll", "", has), "SFT.STEPS.roll.do");
  assert.equal(doKey("roll", undefined, has), "SFT.STEPS.roll.do");
  assert.equal(doKey("chat", "dnd5e", has), "SFT.STEPS.chat.do");
  // The Foundry generation decides when the system has no text of its own
  const keys = key => ["SFT.STEPS.moveKeys.doV13"].includes(key);
  assert.equal(doKey("moveKeys", "dnd5e", keys, 13), "SFT.STEPS.moveKeys.doV13");
  assert.equal(doKey("moveKeys", "dnd5e", keys, 14), "SFT.STEPS.moveKeys.do");
  assert.equal(doKey("moveKeys", "dnd5e", keys), "SFT.STEPS.moveKeys.do");
});

test("a move is told apart: keys, drag or something else", () => {
  const now = 100000;
  assert.equal(classifyMove({now, lastKeyAt: now - 200}), "keys");
  assert.equal(classifyMove({now, lastKeyAt: 0, lastPointerAt: now - 500}), "drag");
  assert.equal(classifyMove({now}), "other");
  assert.equal(classifyMove({now, lastKeyAt: now - KEY_WINDOW - 1}), "other");
  assert.equal(classifyMove({now, lastPointerAt: now - DRAG_WINDOW - 1}), "other");
  // Both are recent: the later one decides, a held key wins
  assert.equal(classifyMove({now, lastKeyAt: now - 100, lastPointerAt: now - 900}), "keys");
  assert.equal(classifyMove({now, lastKeyAt: now - 900, lastPointerAt: now - 100}), "drag");
  assert.equal(classifyMove({now, lastKeyAt: now - 5000, lastPointerAt: now - 100, keyDown: true}), "keys");
  assert.equal(classifyMove({now, keyDown: true}), "keys");
});

test("chat messages: rolls, typed text and whispers to a GM", () => {
  const who = {userId: "p1", isGm: id => id === "gm"};
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, whisper: [], style: 0}, who), ["roll"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: [], style: 1}, who), ["chat"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: [], style: 2}, who), ["chat"]);
  // A card a module posts is not something the player typed
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: [], style: 0}, who), []);
  // A whisper to oneself counts as chat, a whisper to the GM as both
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: ["p1"], style: 1}, who), ["chat"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: ["gm"], style: 1}, who), ["chat", "whisper"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: ["gm"], style: 0}, who), ["chat", "whisper"]);
  // A roll that is whispered is still a roll, and other people's messages are not the player's
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 2, whisper: ["gm"], style: 0}, who), ["roll"]);
  assert.deepEqual(chatEvents({authorId: "p2", rolls: 1, whisper: [], style: 1}, who), []);
  assert.deepEqual(chatEvents(null, who), []);
});

test("the ruler measures when it has two different points", () => {
  assert.equal(isMeasuring(undefined), false);
  assert.equal(isMeasuring([]), false);
  assert.equal(isMeasuring([{x: 1, y: 1}]), false);
  assert.equal(isMeasuring([{x: 1, y: 1}, {x: 1, y: 1}]), false);
  assert.equal(isMeasuring([{x: 1, y: 1}, {x: 1, y: 2}]), true);
});

test("a ping is the player's own when the pointer went down just before", () => {
  assert.equal(isOwnPing({now: 5000, pointerDownAt: 4000}), true);
  assert.equal(isOwnPing({now: 9000, pointerDownAt: 4000}), false);
  assert.equal(isOwnPing({now: 5000, pointerDownAt: 0}), false);
});

test("what the GM sees of a player", () => {
  const offered = STEP_IDS;
  assert.deepEqual(playerSummary({}, {offered, ctx: ALL}), {status: "new", done: 0, skipped: 0, total: 10, percent: 0});
  let p = startProgress({}, 1);
  p = markStep(markStep(p, "sheet", "done", 2), "roll", "skipped", 3);
  assert.deepEqual(playerSummary(p, {offered, ctx: ALL}), {status: "running", done: 1, skipped: 1, total: 10, percent: 20});
  assert.equal(playerSummary(finishProgress(p, 9), {offered, ctx: ALL}).percent, 100);
  assert.equal(playerSummary({}, {offered: [], ctx: ALL}).percent, 0);
  assert.equal(playerSummary({}, {offered, ctx: {...ALL, character: false}}).total, 8);
});

test("changes of a player's progress are counted once", () => {
  const empty = progressDelta(undefined, startProgress({}, 1));
  assert.equal(empty.started, true);
  const p = startProgress({}, 1);
  const a = markStep(p, "sheet", "done", 2);
  assert.deepEqual(progressDelta(p, a), {done: 1, skipped: 0, started: false, finished: false, stopped: false, experienced: false});
  assert.equal(progressDelta(a, a).done, 0);
  const b = markStep(a, "roll", "skipped", 3);
  assert.equal(progressDelta(a, b).skipped, 1);
  assert.equal(progressDelta(b, finishProgress(b, 4)).finished, true);
  assert.equal(progressDelta(finishProgress(b, 4), finishProgress(b, 4)).finished, false);
  assert.equal(progressDelta(b, stopProgress(b, 5)).stopped, true);
  assert.equal(progressDelta({}, experiencedProgress({}, 5)).experienced, true);
  // Starting over does not count the old steps again
  assert.equal(progressDelta(startProgress(finishProgress(b, 4), 6), a).done, 1);
});
