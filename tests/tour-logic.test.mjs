import assert from "node:assert/strict";
import {test} from "node:test";
import {CHAPTERS, CHAPTER_IDS, DRAG_WINDOW, KEY_WINDOW, MAX_OFFERS, SHEET_TABS, STATUS, STEP_DEFS, STEP_IDS, TIP_IDS,
  appKind, chapterOf, chapterSteps, chapterSummary, chaptersSetting, chatEvents, classifyMove, cleanProgress, completes,
  controlEvent, counts, currentStep, doKey, doneKey, experiencedProgress, finishProgress, inviteChapter, isEstablished,
  isMeasuring, isOwnPing, laterProgress, markStep, offerKind, offeredChapters, offeredSteps, permissiveContext, planSteps,
  playerSummary, progressDelta, startProgress, stepEvents, stepsSetting, stopProgress, storedProgress, tipDue,
  tipShownProgress, wantsEvent} from "../scripts/tour-logic.mjs";

const ALL = permissiveContext("dnd5e");
const BASICS = chapterSteps("basics");

test("every step has an icon, needs, requires and a way to be done", () => {
  for ( const id of STEP_IDS ) {
    const def = STEP_DEFS[id];
    assert.ok(Array.isArray(def.needs), id);
    assert.ok(Array.isArray(def.requires), id);
    assert.ok(def.icon.startsWith("fa-"), id);
    assert.ok(def.look || stepEvents(id).length, `${id} can be done`);
  }
  assert.equal(new Set(STEP_IDS).size, STEP_IDS.length);
});

test("every step belongs to one chapter, and the first ten steps keep their old ids", () => {
  assert.deepEqual(BASICS, ["sheet", "roll", "moveKeys", "moveDrag", "target", "ping", "measure", "chat", "whisper", "journal"]);
  assert.deepEqual(CHAPTER_IDS, ["basics", "sidebar", "controls", "charsheet", "chatdice", "fight", "extras"]);
  for ( const chapter of CHAPTERS ) {
    assert.ok(chapter.icon.startsWith("fa-"), chapter.id);
    for ( const id of chapter.steps ) assert.equal(chapterOf(id), chapter.id);
  }
  assert.equal(chapterOf("nope"), "");
  assert.deepEqual(chapterSteps("nope"), []);
  assert.equal(STEP_IDS.length, CHAPTERS.reduce((sum, c) => sum + c.steps.length, 0));
});

test("progress is cleaned and keeps only known steps", () => {
  const p = cleanProgress({status: "running", steps: {sheet: "done", nonsense: "done", roll: "maybe", ping: "skipped"},
    started: 5, offers: 1.7, handledInvite: -3});
  assert.deepEqual(p.steps, {sheet: "done", ping: "skipped"});
  assert.equal(p.chapter, "");
  assert.deepEqual(p.chapters, []);
  assert.equal(p.status, "running");
  assert.equal(p.offers, 1);
  assert.equal(p.handledInvite, 0);
  assert.equal(cleanProgress(null).status, "");
  assert.equal(cleanProgress({status: "weird"}).status, "");
});

test("chapters and tips are cleaned too", () => {
  const p = cleanProgress({chapter: "fight", chapters: ["fight", "nope", "basics"], tips: ["myTurn", "x", "combatStart"]});
  assert.equal(p.chapter, "fight");
  assert.deepEqual(p.chapters, ["basics", "fight"]);
  assert.deepEqual(p.tips, ["combatStart", "myTurn"]);
  assert.equal(cleanProgress({chapter: "nope"}).chapter, "");
  assert.deepEqual(cleanProgress({chapters: "basics"}).chapters, []);
  assert.deepEqual(cleanProgress(storedProgress(p)).tips, p.tips);
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
  assert.equal(startProgress(p, 200, {restart: true}).started, 100);
  assert.equal(startProgress({}, 200, {restart: true}).started, 200);
  const done = finishProgress(p, 300);
  assert.equal(done.status, STATUS.FINISHED);
  assert.equal(done.finished, 300);
  assert.deepEqual(done.chapters, ["basics"]);
  // Starting a finished chapter again forgets only its steps
  const other = markStep(done, "sbChat", "done", 310);
  const again = startProgress(other, 400, {restart: true, chapter: "basics"});
  assert.deepEqual(again.steps, {sbChat: "done"});
  assert.deepEqual(again.chapters, []);
  assert.equal(again.finished, 0);
  assert.equal(again.chapter, "basics");
  assert.deepEqual(startProgress(other, 400, {restart: true, chapter: "sidebar"}).steps, {sheet: "done"});
  // A GM's preview starts from nothing
  assert.deepEqual(startProgress(other, 500, {all: true}).steps, {});
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

test("finishing a chapter remembers it, starting a chapter names it", () => {
  const started = startProgress({}, 1, {chapter: "fight"});
  assert.equal(started.chapter, "fight");
  const done = finishProgress(started, 5);
  assert.deepEqual(done.chapters, ["fight"]);
  const next = finishProgress(startProgress(done, 6, {chapter: "basics"}), 7);
  assert.deepEqual(next.chapters, ["basics", "fight"]);
  assert.equal(startProgress({chapter: "sidebar"}, 8).chapter, "sidebar");
  assert.equal(startProgress({}, 8, {chapter: "nope"}).chapter, "basics");
  assert.equal(inviteChapter("fight"), "fight");
  assert.equal(inviteChapter("nope"), "basics");
  assert.equal(inviteChapter(undefined), "basics");
});

test("the plan drops character steps without a character and marks what is missing", () => {
  const none = planSteps({offered: STEP_IDS, progress: {}, ctx: {...ALL, character: false}, chapter: "basics"});
  assert.deepEqual(none.map(s => s.id), BASICS.filter(id => !STEP_DEFS[id].needs.includes("character")));
  const noToken = planSteps({offered: STEP_IDS, progress: {}, ctx: {...ALL, ownToken: false, otherToken: false}, chapter: "basics"});
  assert.deepEqual(noToken.find(s => s.id === "moveKeys").missing, ["ownToken"]);
  assert.deepEqual(noToken.find(s => s.id === "target").missing, ["otherToken"]);
  assert.deepEqual(noToken.find(s => s.id === "chat").missing, []);
  assert.deepEqual(noToken.find(s => s.id === "sheet").missing, []);
});

test("the plan follows the steps the GM offers and the progress", () => {
  const offered = ["sheet", "ping", "chat"];
  let progress = {};
  let plan = planSteps({offered, progress, ctx: ALL, chapter: "basics"});
  assert.deepEqual(plan.map(s => s.id), ["sheet", "ping", "chat"]);
  assert.equal(currentStep(plan).id, "sheet");
  progress = markStep(markStep(progress, "sheet", "done", 1), "ping", "skipped", 2);
  plan = planSteps({offered, progress, ctx: ALL, chapter: "basics"});
  assert.equal(currentStep(plan).id, "chat");
  assert.deepEqual(counts(plan), {total: 3, done: 1, skipped: 1, left: 1});
  progress = markStep(progress, "chat", "done", 3);
  assert.equal(currentStep(planSteps({offered, progress, ctx: ALL, chapter: "basics"})), null);
  // A step turned off after it was done does not count
  assert.equal(counts(planSteps({offered: ["ping", "chat"], progress, ctx: ALL, chapter: "basics"})).total, 2);
  // Without a chapter the plan has the steps of all chapters
  assert.equal(planSteps({offered: STEP_IDS, progress: {}, ctx: ALL}).length, STEP_IDS.length);
});

test("a step drops out when the interface or the system does not have what it points at", () => {
  const plan = ctx => planSteps({offered: STEP_IDS, progress: {}, ctx, chapter: "sidebar"}).map(s => s.id);
  assert.ok(plan(ALL).includes("sbScenes"));
  assert.ok(!plan({...ALL, "tab:scenes": false}).includes("sbScenes"));
  assert.ok(!plan({...ALL, "tab:playlists": false}).includes("sbVolume"));
  assert.ok(!plan({...ALL, "ui:rollmode": false}).includes("sbMode"));
  const sheet = ctx => planSteps({offered: STEP_IDS, progress: {}, ctx, chapter: "charsheet"}).map(s => s.id);
  assert.ok(sheet(ALL).includes("shAbilities") && sheet(ALL).includes("shRest"));
  const pf2e = sheet(permissiveContext("pf2e"));
  assert.ok(!pf2e.includes("shAbilities") && !pf2e.includes("shSkills") && !pf2e.includes("shRest"));
  assert.ok(pf2e.includes("shInventory") && pf2e.includes("shSpells") && pf2e.includes("shFeatures"));
  assert.ok(!sheet({...ALL, character: false}).length);
  // Steps of the sheet wait for the sheet, the fight steps for the fight
  const wait = planSteps({offered: STEP_IDS, progress: {}, ctx: {...ALL, sheetOpen: false, combat: false, myCombatant: false,
    myTurn: false, rollCard: false}});
  assert.deepEqual(wait.find(s => s.id === "shTabs").missing, ["sheetOpen"]);
  assert.deepEqual(wait.find(s => s.id === "fiInitiative").missing, ["myCombatant"]);
  assert.deepEqual(wait.find(s => s.id === "fiEnd").missing, ["myTurn"]);
  assert.deepEqual(wait.find(s => s.id === "fiTracker").missing, ["combat"]);
  assert.deepEqual(wait.find(s => s.id === "cdOpen").missing, ["rollCard"]);
  assert.deepEqual(wait.find(s => s.id === "shOpen").missing, []);
});

test("the permissive context answers for the game system of the world only", () => {
  assert.equal(permissiveContext("dnd5e")["system:dnd5e"], true);
  assert.equal(permissiveContext("pf2e")["system:dnd5e"], false);
  assert.equal(permissiveContext("pf2e")["tab:chat"], true);
  assert.equal(permissiveContext("pf2e").combat, true);
});

test("the chapters offered round trip through the setting", () => {
  assert.deepEqual(offeredChapters(undefined), CHAPTER_IDS);
  assert.deepEqual(offeredChapters({disabled: ["fight", "unknown"]}), CHAPTER_IDS.filter(id => id !== "fight"));
  assert.deepEqual(chaptersSetting(CHAPTER_IDS.filter(id => id !== "fight")), {disabled: ["fight"]});
  assert.deepEqual(offeredChapters(chaptersSetting(["extras", "basics"])), ["basics", "extras"]);
});

test("a chapter's summary counts its steps and knows when it is done", () => {
  const offered = STEP_IDS;
  assert.deepEqual(chapterSummary({}, "basics", {offered, ctx: ALL}), {id: "basics", done: 0, skipped: 0, total: 10, finished: false, state: "new"});
  const p = markStep(markStep(startProgress({}, 1), "sheet", "done", 2), "roll", "skipped", 3);
  assert.deepEqual(chapterSummary(p, "basics", {offered, ctx: ALL}), {id: "basics", done: 1, skipped: 1, total: 10, finished: false, state: "part"});
  assert.equal(chapterSummary(p, "sidebar", {offered, ctx: ALL}).state, "new");
  // A chapter counts as done when it is on the finished list, or when every step is behind the player (version 1.0.0 data)
  assert.equal(chapterSummary(finishProgress(p, 9), "basics", {offered, ctx: ALL}).finished, true);
  const legacy = {status: "finished", done: BASICS.slice(0, 8), skipped: BASICS.slice(8)};
  assert.equal(chapterSummary(legacy, "basics", {offered, ctx: ALL}).finished, true);
  assert.equal(chapterSummary(legacy, "sidebar", {offered, ctx: ALL}).finished, false);
  assert.equal(chapterSummary({}, "basics", {offered: [], ctx: ALL}).finished, false);
});

test("the offered steps round trip through the setting", () => {
  assert.deepEqual(offeredSteps(undefined), STEP_IDS);
  assert.deepEqual(offeredSteps({disabled: ["ping", "unknown"]}), STEP_IDS.filter(id => id !== "ping"));
  assert.deepEqual(stepsSetting(STEP_IDS.filter(id => id !== "ping")), {disabled: ["ping"]});
  assert.deepEqual(offeredSteps(stepsSetting(["chat", "sheet"])), ["sheet", "chat"]);
});

test("tab steps of the sheet accept the names of several systems", () => {
  assert.ok(stepEvents("shSpells").includes("sheetTab:spells"));
  assert.ok(stepEvents("shSpells").includes("sheetTab:powers"));
  assert.ok(stepEvents("shInventory").includes("sheetTab:gear"));
  assert.equal(completes("shFeatures", "sheetTab:talents"), true);
  assert.equal(completes("shFeatures", "sheetTab:spells"), false);
  // Any tab completes the step about tabs
  assert.equal(completes("shTabs", "sheetTab:biography"), true);
  assert.equal(completes("shTabs", "tab:chat"), false);
  for ( const names of Object.values(SHEET_TABS) ) assert.ok(names.length > 1);
});

test("sidebar tabs, control layers and tools complete their own steps", () => {
  assert.equal(completes("sbChat", "tab:chat"), true);
  assert.equal(completes("sbChat", "tab:combat"), false);
  assert.equal(completes("sbCombat", "tab:combat"), true);
  assert.equal(completes("fiTracker", "tab:combat"), true);
  assert.equal(completes("scRuler", "tool:ruler"), true);
  assert.equal(completes("scTarget", "tool:ruler"), false);
  assert.equal(completes("scHelp", "tool:sftHelp"), true);
  assert.equal(completes("scKeys", "app:controls"), true);
  assert.equal(completes("cdWhisper", "whisper:any"), true);
  assert.equal(completes("cdWhisper", "whisper"), false);
  assert.equal(completes("scShapes", controlEvent("templates")), true);
  assert.equal(completes("scShapes", controlEvent("regions")), true);
  assert.equal(completes("scNotes", controlEvent("notes")), true);
  assert.equal(completes("scTokens", controlEvent("tokens")), true);
  assert.equal(completes("sbControls", "app:controls"), true);
  assert.equal(completes("sbConfigure", "app:settings"), true);
  assert.equal(completes("fiHud", "hud"), true);
  assert.equal(completes("fiHud", "hud:effects"), false);
  assert.equal(completes("fiConditions", "hud:effects"), true);
  assert.equal(completes("exPause", "anything"), false);
  assert.equal(completes("exPause", ""), false);
});

test("the detection listens only for what the step on the card waits for", () => {
  assert.equal(wantsEvent("moveKeys", "move"), true);
  assert.equal(wantsEvent("moveKeys", "ping"), false);
  assert.equal(wantsEvent("sbChat", "tab"), true);
  assert.equal(wantsEvent("sbChat", "control"), false);
  assert.equal(wantsEvent("shTabs", "sheetTab"), true);
  assert.equal(wantsEvent("shSpells", "sheetTab"), true);
  assert.equal(wantsEvent("shAbilities", "roll"), true);
  assert.equal(wantsEvent("cdRoll", "roll"), true);
  assert.equal(wantsEvent("exPause", "ui"), false);
  assert.equal(wantsEvent("nope", "tab"), false);
});

test("windows are told apart for the settings steps", () => {
  assert.equal(appKind({id: "controls"}), "controls");
  assert.equal(appKind({name: "ControlsConfig"}), "controls");
  assert.equal(appKind({id: "client-settings"}), "settings");
  assert.equal(appKind({name: "SettingsConfig"}), "settings");
  assert.equal(appKind({id: "sheet", name: "ActorSheet"}), "");
  assert.equal(appKind(), "");
  assert.equal(controlEvent("tokens"), "control:tokens");
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
  // Other parts of a step follow the same rule
  const text = key => key === "SFT.STEPS.sbMode.textV14";
  assert.equal(doKey("sbMode", "dnd5e", text, 14, "text"), "SFT.STEPS.sbMode.textV14");
  assert.equal(doKey("sbMode", "dnd5e", text, 13, "text"), "SFT.STEPS.sbMode.text");
});

test("a step without a line of its own gets the general done text", () => {
  assert.equal(doneKey("sheet", key => key === "SFT.STEPS.sheet.done"), "SFT.STEPS.sheet.done");
  assert.equal(doneKey("sbChat", () => false), "SFT.card.doneGeneral");
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
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: ["p1"], style: 1}, who), ["chat", "whisper:any"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: ["gm"], style: 1}, who), ["chat", "whisper", "whisper:any"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, whisper: ["gm"], style: 0}, who), ["chat", "whisper", "whisper:any"]);
  // A roll that is whispered is still a roll, and other people's messages are not the player's
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 2, whisper: ["gm"], style: 0}, who), ["roll", "roll:private"]);
  assert.deepEqual(chatEvents({authorId: "p2", rolls: 1, whisper: [], style: 1}, who), []);
  assert.deepEqual(chatEvents(null, who), []);
});

test("chat messages: typed rolls, sheet rolls, emotes and rolls inside a message", () => {
  const who = {userId: "p1", isGm: id => id === "gm"};
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, typed: "/r 1d20"}, who), ["roll", "roll:typed"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, typed: "/roll 2d6"}, who), ["roll", "roll:typed"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, typed: "/gmroll 1d6", whisper: ["gm"]}, who), ["roll", "roll:typed", "roll:private"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, typed: ""}, who), ["roll"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, typed: "hello"}, who), ["roll"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, sheetRoll: "skill"}, who), ["roll", "roll:skill"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 1, sheetRoll: "ability", whisper: ["p1"]}, who), ["roll", "roll:ability", "roll:private"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, style: 3}, who), ["chat", "emote"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, style: 1, typed: "I try the door [[/r 1d20]]"}, who), ["chat", "inline"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, style: 1, content: "plain"}, who), ["chat"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, style: 1, content: "[[/r 1d6]] damage"}, who), ["chat", "inline"]);
  assert.deepEqual(chatEvents({authorId: "p1", rolls: 0, style: 1, content: "[[ ]]"}, who), ["chat"]);
});

test("the tour tips: when a tip is due at a fight", () => {
  const base = {tip: "combatStart", progress: {}, mode: "auto", isGM: false};
  assert.equal(tipDue(base), true);
  assert.equal(tipDue({...base, tip: "myTurn"}), true);
  assert.equal(tipDue({...base, tip: "nope"}), false);
  assert.equal(tipDue({...base, isGM: true}), false);
  assert.equal(tipDue({...base, enabled: false}), false);
  assert.equal(tipDue({...base, mode: "gm"}), false);
  assert.equal(tipDue({...base, mode: "off"}), false);
  // Only players who said they know Foundry are left alone
  assert.equal(tipDue({...base, progress: {status: "experienced"}}), false);
  // Stopping the guide or saying not now does not silence the tips
  for ( const status of ["stopped", "later"] ) assert.equal(tipDue({...base, progress: {status}}), true, status);
  assert.equal(tipDue({...base, progress: {status: "finished", chapters: ["basics"]}}), true);
  assert.equal(tipDue({...base, progress: {status: "running"}}), true);
  // Each tip once, and not when the fight chapter is known
  assert.equal(tipDue({...base, progress: {tips: ["combatStart"]}}), false);
  assert.equal(tipDue({...base, tip: "myTurn", progress: {tips: ["combatStart"]}}), true);
  assert.equal(tipDue({...base, progress: {chapters: ["fight"]}}), false);
  assert.equal(tipDue({...base, progress: {done: ["fiTracker"]}}), false);
  assert.equal(tipDue({...base, progress: {skipped: ["fiTarget"]}}), false);
  // Not when the GM left the chapter out
  assert.equal(tipDue({...base, chapters: ["basics"]}), false);
  assert.equal(tipDue({...base, offered: ["sheet"]}), false);
  assert.equal(tipDue({...base, offered: ["fiTarget"], progress: {}}), true);
});

test("a shown tip is remembered once", () => {
  const p = tipShownProgress({}, "myTurn", 5);
  assert.deepEqual(p.tips, ["myTurn"]);
  assert.deepEqual(tipShownProgress(p, "combatStart", 6).tips, ["combatStart", "myTurn"]);
  assert.deepEqual(tipShownProgress(p, "myTurn", 7), p);
  assert.deepEqual(tipShownProgress({}, "bogus", 1).tips, []);
  assert.deepEqual(TIP_IDS, ["combatStart", "myTurn"]);
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
  const basics = ["basics"];
  const none = playerSummary({}, {offered, chapters: basics, ctx: ALL});
  assert.deepEqual([none.status, none.done, none.skipped, none.total, none.percent, none.chaptersDone, none.chaptersTotal],
    ["new", 0, 0, 10, 0, 0, 1]);
  const p = markStep(markStep(startProgress({}, 1), "sheet", "done", 2), "roll", "skipped", 3);
  const part = playerSummary(p, {offered, chapters: basics, ctx: ALL});
  assert.deepEqual([part.status, part.done, part.skipped, part.total, part.percent], ["running", 1, 1, 10, 20]);
  assert.equal(playerSummary(finishProgress(p, 9), {offered, chapters: basics, ctx: ALL}).percent, 100);
  assert.equal(playerSummary({}, {offered: [], ctx: ALL}).percent, 0);
  assert.equal(playerSummary({}, {offered, chapters: basics, ctx: {...ALL, character: false}}).total, 8);
  // All chapters: finishing one counts for its share
  const all = playerSummary(finishProgress(p, 9), {offered, ctx: ALL});
  assert.equal(all.chaptersTotal, CHAPTER_IDS.length);
  assert.equal(all.chaptersDone, 1);
  assert.equal(all.chapters.length, CHAPTER_IDS.length);
  assert.ok(all.percent > 0 && all.percent < 100);
  assert.equal(all.total, planSteps({offered, progress: {}, ctx: ALL}).length);
});

test("changes of a player's progress are counted once", () => {
  const empty = progressDelta(undefined, startProgress({}, 1));
  assert.equal(empty.started, true);
  const p = startProgress({}, 1);
  const a = markStep(p, "sheet", "done", 2);
  assert.deepEqual(progressDelta(p, a), {done: 1, skipped: 0, started: false, finished: false, stopped: false, experienced: false,
    chapterStarted: false, chapterFinished: 0, tips: 0});
  assert.equal(progressDelta(a, a).done, 0);
  const b = markStep(a, "roll", "skipped", 3);
  assert.equal(progressDelta(a, b).skipped, 1);
  assert.equal(progressDelta(b, finishProgress(b, 4)).finished, true);
  assert.equal(progressDelta(finishProgress(b, 4), finishProgress(b, 4)).finished, false);
  assert.equal(progressDelta(b, stopProgress(b, 5)).stopped, true);
  assert.equal(progressDelta({}, experiencedProgress({}, 5)).experienced, true);
  // Starting over does not count the old steps again
  assert.equal(progressDelta(startProgress(finishProgress(b, 4), 6, {restart: true}), a).done, 1);
});

test("chapters and tips are counted once", () => {
  const a = startProgress({}, 1, {chapter: "basics"});
  assert.equal(progressDelta({}, a).chapterStarted, true);
  assert.equal(progressDelta(a, a).chapterStarted, false);
  const b = startProgress(finishProgress(a, 2), 3, {chapter: "sidebar"});
  assert.equal(progressDelta(finishProgress(a, 2), b).chapterStarted, true);
  assert.equal(progressDelta(a, finishProgress(a, 2)).chapterFinished, 1);
  assert.equal(progressDelta(finishProgress(a, 2), finishProgress(a, 2)).chapterFinished, 0);
  assert.equal(progressDelta(a, tipShownProgress(a, "combatStart", 4)).tips, 1);
  assert.equal(progressDelta(tipShownProgress(a, "combatStart", 4), tipShownProgress(a, "combatStart", 5)).tips, 0);
});
