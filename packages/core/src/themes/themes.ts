// The fixed theme taxonomy (TRD 6.1) and the device-side keyword hints. The cooperative
// cross-checks these with Groq in P1; Groq can only choose from THEME_IDS (a fixed enum).
//
// Matching: whole word or whole phrase on normalized text, in every language at once (a guest
// may mix languages). A theme either matches or it doesn't; when several match, the earliest in
// taxonomy order wins ("How long is the roasting?" is `roast`, not `length`). No match is `other`.
//
// DRAFT HINTS: a first list for Bee and Preet to review against real questions. Whole-word
// matching means inflected forms are listed one by one, so expect gaps; a miss falls to `other`,
// and the cooperative's cloud theme corrects it.

import { normalize } from "../text/normalize.ts";
import { type ThemeId, VISITOR_LANGS, type VisitorLang } from "../types.ts";

export interface Theme {
  id: ThemeId;
  hints: Record<VisitorLang, readonly string[]>;
}

const NONE: Record<VisitorLang, readonly string[]> = { en: [], de: [], nl: [], sv: [] };

export const THEMES: readonly Theme[] = [
  {
    id: "stay",
    hints: {
      en: ["overnight", "sleep", "accommodation", "guesthouse", "bed", "camp", "camping", "lodge"],
      de: ["übernachten", "übernachtung", "schlafen", "unterkunft", "zimmer", "bett", "zelt"],
      nl: ["overnachten", "overnachting", "slapen", "accommodatie", "kamer", "bed", "kamperen"],
      sv: ["övernatta", "övernattning", "sova", "boende", "säng", "tälta", "camping"],
    },
  },
  {
    id: "food",
    hints: {
      en: ["food", "eat", "lunch", "meal", "restaurant", "hungry", "dinner", "breakfast", "snack"],
      de: ["essen", "mittagessen", "abendessen", "frühstück", "hunger", "hungrig", "mahlzeit"],
      nl: ["eten", "lunch", "maaltijd", "honger", "ontbijt", "diner", "recept"],
      sv: ["mat", "äta", "lunch", "måltid", "restaurang", "hungrig", "frukost", "middag"],
    },
  },
  {
    id: "buy",
    hints: {
      en: ["buy", "purchase", "shop", "sell", "souvenir", "souvenirs", "gift"],
      de: ["kaufen", "kauf", "verkaufen", "verkauft", "laden", "shop", "bestellen", "bestellung"],
      nl: ["kopen", "koop", "verkopen", "verkoopt", "winkel", "souvenir", "bestellen"],
      sv: ["köpa", "köp", "sälja", "säljer", "butik", "souvenir", "beställa"],
    },
  },
  {
    id: "price",
    hints: {
      en: ["price", "prices", "cost", "costs", "how much", "expensive", "cheap", "fee", "ticket"],
      de: ["preis", "preise", "kosten", "kostet", "teuer", "billig", "bezahlen", "eintritt"],
      nl: ["prijs", "prijzen", "kosten", "kost", "duur", "goedkoop", "betalen", "hoeveel"],
      sv: ["pris", "priser", "kostar", "kostnad", "dyrt", "billigt", "betala", "hur mycket"],
    },
  },
  {
    id: "path",
    hints: {
      en: ["path", "trail", "walk", "walking", "hike", "hiking", "route", "map", "steep", "steps"],
      de: ["weg", "pfad", "wandern", "wanderung", "route", "karte", "steil", "spazieren"],
      nl: ["pad", "paden", "wandelen", "wandeling", "route", "kaart", "steil"],
      sv: ["stig", "stigen", "vandra", "vandring", "rutt", "karta", "brant", "promenad"],
    },
  },
  {
    id: "kids",
    hints: {
      en: ["kids", "kid", "children", "child", "family", "baby", "toddler"],
      de: ["kinder", "kind", "familie", "baby", "kleinkind"],
      nl: ["kinderen", "kind", "gezin", "familie", "baby", "peuter"],
      sv: ["barn", "barnen", "familj", "bebis", "småbarn"],
    },
  },
  {
    id: "roast",
    hints: {
      en: ["roast", "roasts", "roasting", "roasted", "roaster", "roastery"],
      de: ["rösten", "geröstet", "röstung", "rösterei", "röster"],
      nl: ["roosteren", "geroosterd", "roosterij", "branden", "gebrand", "branderij"],
      sv: ["rosta", "rostas", "rostning", "rostad", "rosteri"],
    },
  },
  {
    id: "picking",
    hints: {
      en: ["pick", "picks", "picking", "picked", "harvest", "cherry", "cherries", "ripe", "pluck"],
      de: ["pflücken", "pflückt", "ernte", "ernten", "kirschen", "kaffeekirschen", "reif"],
      nl: ["plukken", "geplukt", "oogst", "oogsten", "kersen", "koffiekersen", "rijp"],
      sv: ["plocka", "plockar", "plockning", "skörd", "skörda", "körsbär", "kaffebär", "mogen"],
    },
  },
  {
    id: "story",
    hints: {
      en: ["story", "stories", "history", "tradition", "founded", "cooperative", "generations"],
      de: ["geschichte", "gegründet", "tradition", "genossenschaft", "generationen", "herkunft"],
      nl: ["verhaal", "geschiedenis", "opgericht", "traditie", "coöperatie", "generaties"],
      sv: [
        "historia",
        "historien",
        "berättelse",
        "grundades",
        "tradition",
        "kooperativ",
        "ursprung",
      ],
    },
  },
  {
    id: "view",
    hints: {
      en: ["view", "views", "scenery", "photo", "photos", "landscape", "sunset", "viewpoint"],
      de: ["aussicht", "blick", "foto", "fotos", "landschaft", "sonnenuntergang", "panorama"],
      nl: ["uitzicht", "foto", "foto's", "landschap", "zonsondergang", "panorama"],
      sv: ["utsikt", "foto", "landskap", "solnedgång", "panorama", "fotografera"],
    },
  },
  {
    id: "welcome",
    hints: {
      en: ["welcome", "hello", "greeting", "greetings", "thank you", "thanks"],
      de: ["willkommen", "hallo", "danke", "begrüßung"],
      nl: ["welkom", "hallo", "bedankt", "begroeting", "dank"],
      sv: ["välkommen", "hej", "tack", "hälsning"],
    },
  },
  {
    id: "taste",
    hints: {
      en: ["taste", "tastes", "flavor", "flavour", "sweet", "bitter", "strong", "aroma", "smell"],
      de: ["geschmack", "schmeckt", "schmecken", "süß", "bitter", "stark", "aroma", "verkostung"],
      nl: ["smaak", "smaken", "smaakt", "zoet", "bitter", "sterk", "aroma", "proeven", "geur"],
      sv: ["smak", "smakar", "söt", "bitter", "stark", "arom", "provsmaka", "doft"],
    },
  },
  {
    id: "length",
    hints: {
      en: ["how long", "duration", "minutes", "hours", "length"],
      de: ["wie lange", "dauer", "dauert", "minuten", "stunden"],
      nl: ["hoe lang", "duurt", "minuten", "uur", "uren"],
      sv: ["hur länge", "varaktighet", "minuter", "timmar"],
    },
  },
  {
    id: "wifi",
    hints: {
      en: ["wifi", "wi fi", "internet", "signal", "network", "password", "online"],
      de: ["wlan", "wifi", "wi fi", "internet", "empfang", "netz", "passwort"],
      nl: ["wifi", "wi fi", "internet", "bereik", "netwerk", "wachtwoord"],
      sv: ["wifi", "wi fi", "internet", "täckning", "nätverk", "lösenord", "uppkoppling"],
    },
  },
  {
    id: "transport",
    hints: {
      en: ["transport", "taxi", "bus", "car", "parking", "drive", "driving", "shuttle", "pickup"],
      de: ["transport", "taxi", "bus", "auto", "parkplatz", "fahren", "shuttle", "abholung"],
      nl: ["vervoer", "taxi", "bus", "auto", "parkeren", "parkeerplaats", "rijden", "shuttle"],
      sv: ["transport", "taxi", "buss", "bil", "parkering", "köra", "skjuts", "shuttle"],
    },
  },
  { id: "other", hints: NONE },
];

/** Theme ids in taxonomy order; tie-breaks and the Groq enum both follow it. */
export const THEME_ORDER: readonly ThemeId[] = THEMES.map((theme) => theme.id);

// Normalized once; every language is searched, whatever language the guest chose.
const COMPILED: readonly { id: ThemeId; patterns: readonly string[] }[] = THEMES.map((theme) => ({
  id: theme.id,
  patterns: VISITOR_LANGS.flatMap((lang) => theme.hints[lang]).map((hint) => normalize(hint)),
}));

/** Device-side theme for a question or a piece of feedback. `other` when nothing matches. */
export function themeOf(text: string): ThemeId {
  const padded = normalize(text);
  for (const { id, patterns } of COMPILED) {
    if (patterns.some((pattern) => padded.includes(pattern))) return id;
  }
  return "other";
}
