/**
 * Sample windows (api.samples, contract in samples.mjs): the tour card at each of its steps and states, and the GM's
 * overview with made-up players, so translators and testers see every text in its place without a first login. Nothing
 * here writes: no tour starts, no user flag changes, no setting is saved, no usage counter counts. The cards are drawn by
 * the module's own card code into a framed window, the overview is the real window over made-up players.
 */

import {MODULE_ID, t} from "./config.mjs";
import {cardMarkup} from "./card.mjs";
import {OverviewApp} from "./overview-app.mjs";
import {cardModels} from "./tour.mjs";
import {SAMPLE_CHAPTERS, chapterCards, sampleRows} from "./sample-data.mjs";
import {CHAPTER_IDS} from "./tour-logic.mjs";
import {closeSample, markSample, openSampleDialog, openSampleHtml, sampleActions, sampleCast, sampleId} from "./samples.mjs";

const chapterTitle = id => t(`SFT.CHAPTERS.${id}.title`);

/** The first player of the shared sample cast, the name the offers speak to. */
const playerName = () => sampleCast().find(c => c.side === "party")?.player ?? "Lena";

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

/**
 * A window with cards side by side, drawn again on every render so they follow the translations.
 * @param {string} id
 * @param {string} title
 * @param {() => object[]} models   The cards (card models, see tour.mjs)
 * @param {{tall?: boolean}} [options]   A tall window scrolls
 * @returns {Promise<Application>}
 */
async function openCards(id, title, models, {tall = false} = {}) {
  const app = await openSampleHtml({moduleId: MODULE_ID, id, title, width: 740, classes: ["sft-sample-window"],
    body: () => `<div class="sft-sample-cards">${models().map(cardMarkup).join("")}</div>`});
  if ( tall ) await app.setPosition({height: Math.min(700, Math.max(360, window.innerHeight - 90))});
  return app;
}

/** The three offers: first login, the GM starts it, the GM names a chapter. */
const offerCards = () => [
  cardModels.offer("offer", playerName(), CHAPTER_IDS[0]),
  cardModels.offer("invited", playerName(), CHAPTER_IDS[0]),
  cardModels.offer("invited", playerName(), "fight")
];

/** The chapter list as a new player, a player in the middle of it and an experienced player see it. */
const menuCards = () => {
  const rows = sampleRows("mixed");
  const of = id => rows.find(r => r.id === id).progress;
  return [cardModels.menu({}), cardModels.menu(of("sample-lena")), cardModels.menu(of("sample-sam"))];
};

/** The end of a chapter, the folded card and the fight tips. */
const doneCards = () => {
  const total = 10;
  return [
    cardModels.done(CHAPTER_IDS[0], CHAPTER_IDS[1]),
    cardModels.done("fight", "extras"),
    cardModels.done("extras", null),
    {...cardModels.step({id: "ping", missing: []}, {total, done: 5, skipped: 0}, CHAPTER_IDS[0], true)},
    {mode: "offer", icon: "fa-solid fa-compass", title: "", kicker: "", folded: true},
    cardModels.tip("combatStart"),
    cardModels.tip("myTurn")
  ];
};

/** Every step of a chapter, each with the card that follows when it is done. */
const chapterModels = chapterId => chapterCards(chapterId).flatMap(({id, done, total, missing}) => [
  cardModels.step({id, missing}, {total, done, skipped: 0}, chapterId, false),
  cardModels.flash(id, {total, done: done + 1, skipped: 0}, chapterId)
]);

/* -------------------------------------------- */
/*  Overview                                    */
/* -------------------------------------------- */

/** The overview over made-up players. Its buttons only say that they do nothing, nothing is stored. */
class SampleOverview extends OverviewApp {
  constructor({key, rows, mode}) {
    super({id: sampleId(MODULE_ID, key), actions: sampleActions(OverviewApp)});
    this.sampleRows = rows;
    this.sampleMode = mode;
    markSample(this);
  }

  _rows() {
    return this.sampleRows.map(({progress, ...user}) => ({user, progress}));
  }

  _mode() {
    return this.sampleMode;
  }
}

async function openOverview(key, kind, mode) {
  await closeSample(sampleId(MODULE_ID, key));
  const app = new SampleOverview({key, rows: kind ? sampleRows(kind) : [], mode});
  await app.render({force: true});
  return app;
}

/** The question "Mark everybody as experienced": its texts, with buttons that do nothing. */
function openAsk() {
  return openSampleDialog({moduleId: MODULE_ID, id: "ask", title: t("SFT.Overview.allExperienced"),
    content: `<p>${t("SFT.Overview.allExperiencedAsk")}</p>`,
    buttons: [
      {label: t("SFT.Overview.allExperiencedYes"), icon: "fa-solid fa-check", default: true},
      {label: t("SFT.Overview.cancel"), icon: "fa-solid fa-xmark"}
    ]});
}

/* -------------------------------------------- */
/*  The list                                    */
/* -------------------------------------------- */

/**
 * The sample windows of the module (api.samples).
 * @returns {{id: string, label: string, group: string, open: () => Promise<object>}[]}
 */
export function sampleWindows() {
  const card = t("SFT.Sample.groupCard");
  const overview = t("SFT.Overview.title");
  const cardEntry = (id, label, models, options) => ({id, group: card, label: `${card}: ${label}`,
    open: () => openCards(id, `${card}: ${label}`, models, options)});
  const entries = [
    cardEntry("offers", t("SFT.Sample.offers"), offerCards),
    cardEntry("menu", t("SFT.Sample.menu"), menuCards),
    cardEntry("done", t("SFT.Sample.done"), doneCards)
  ];
  for ( const id of SAMPLE_CHAPTERS ) {
    entries.push(cardEntry(`chapter-${id}`, chapterTitle(id), () => chapterModels(id), {tall: true}));
  }
  entries.push(
    {id: "overview", group: overview, label: `${overview}: ${t("SFT.Sample.overviewPlayers")}`,
      open: () => openOverview("overview", "mixed", "auto")},
    {id: "overview-more", group: overview, label: `${overview}: ${t("SFT.Sample.overviewMore")}`,
      open: () => openOverview("overview-more", "more", "gm")},
    {id: "overview-empty", group: overview, label: `${overview}: ${t("SFT.Sample.overviewEmpty")}`,
      open: () => openOverview("overview-empty", null, "off")},
    {id: "overview-ask", group: overview, label: `${overview}: ${t("SFT.Overview.allExperienced")}`, open: openAsk}
  );
  return entries;
}
