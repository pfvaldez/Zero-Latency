// DRAFT Swedish strings: written by an AI assistant and NOT yet checked by a native speaker
// (non-negotiables 2, 5 and 9). Marked "draft" in I18N_STATUS; the guest app shows the
// "draft translation" label in demo mode, and a production build needs a native-speaker check.

import type { Strings } from "./index.ts";

export const sv: Strings = {
  "app.name": "Ask Noor",

  "lang.title": "Välj språk",
  "lang.change": "Byt språk",
  "lang.en": "English",
  "lang.de": "Deutsch",
  "lang.nl": "Nederlands",
  "lang.sv": "Svenska",

  "nav.stops": "Stopp",
  "nav.ask": "Fråga",
  "nav.shop": "Butik",
  "nav.feedback": "Feedback",

  "common.close": "Stäng",
  "common.back": "Tillbaka",
  "common.loading": "Laddar …",
  "common.ok": "OK",

  "pack.title": "Ladda ner gårdsturen",
  "pack.body": "Ladda ner en gång medan du har täckning. Efter det fungerar turen utan internet.",
  "pack.size": "Nedladdningsstorlek: {size}",
  "pack.download": "Ladda ner",
  "pack.progress": "Laddar ner … {percent} %",
  "pack.retry": "Försök igen",
  "pack.done": "Klart. Turen fungerar nu offline.",
  "pack.error": "Nedladdningen blev inte klar. Kontrollera din täckning och försök igen.",
  "pack.storage": "Din telefon kan fråga om turen får sparas. Tillåt det.",
  "pack.update": "Det finns en nyare tur. Uppdatera när du har täckning.",

  "stops.title": "Turens stopp",
  "stops.stop": "Stopp {n}",
  "stops.scan": "Skanna en stoppkod",
  "stops.number": "Eller skriv in stoppets nummer",
  "stops.numberLabel": "Stoppnummer",
  "stops.go": "Öppna stoppet",
  "stops.cameraDenied": "Kameran är inte tillgänglig. Skriv in stoppets nummer i stället.",
  "stops.notFound": "Vi hittade inte det stoppet. Kontrollera numret och försök igen.",

  "player.play": "Spela upp",
  "player.pause": "Pausa",
  "player.subtitles": "Undertexter",
  "player.noorSays": "Noors egen inspelning",
  "player.sourceFallback": "Undertexterna visas tills vidare på Noors språk.",

  "facts.title": "Visste du att?",
  "facts.source": "Källa: {source}",
  "recipe.title": "Noors recept",
  "farm.title": "Om gården",
  "farm.contact": "Ring eller skicka sms till Noor för att boka ett besök eller fråga mer.",

  "ask.title": "Ställ en fråga till Noor",
  "ask.placeholder": "Skriv din fråga",
  "ask.submit": "Fråga",
  "ask.confirm": "Noor berättar om {topic}. Är det här vad du frågade om?",
  "ask.yes": "Ja, spela upp",
  "ask.no": "Nej",
  "ask.savedNo": "Tack. Vi har sparat din fråga till Noor.",
  "ask.saved.title": "Inte säker, fråga en person",
  "ask.saved.body":
    "Vi kunde inte koppla din fråga till något som Noor har sagt. Vi har sparat den till Noor. Fråga gärna din guide eller en person på gården.",
  "ask.safety.title": "Fråga din guide",
  "ask.safety.body":
    "Vid frågor om hälsa, säkerhet eller nödsituationer: hitta din guide eller en person på gården direkt. Den här appen kan inte hjälpa vid nödsituationer. Vi har inte sparat din fråga.",

  "feedback.title": "Berätta för Noor vad du tycker",
  "feedback.loved": "Vad älskade du?",
  "feedback.change": "Vad skulle du ändra?",
  "feedback.optional": "Valfritt",
  "feedback.privacy": "Skriv inte ditt namn eller dina kontaktuppgifter.",
  "feedback.submit": "Skicka",
  "feedback.thanks": "Tack! Noor får höra om det.",

  "shop.title": "Butik",
  "shop.empty": "Din korg är tom.",
  "shop.qty": "Antal",
  "shop.total": "Totalt: {total} {currency}",
  "shop.order": "Beställ",
  "shop.showNoor": "Visa det här för Noor",
  "shop.noorConfirms": "Noor bekräftar din betalning personligen.",
  "shop.noPayment": "Ingen betalning sker i appen. Du betalar Noor personligen.",
  "shop.confirmed": "Noor har bekräftat din beställning.",

  "sync.pending": "{n} poster väntar på att skickas",
  "sync.done": "Allt är skickat.",
  "sync.offline": "Du är offline. Turen fungerar ändå.",
  "sync.willSend": "Dina svar skickas när du har täckning.",

  "labels.demo": "Demoläge",
  "labels.draftTranslation": "Utkast till översättning, inte kontrollerad än",
  "labels.standIn": "Platshållare: {what}",
  "labels.aiVoice": "AI-berättarröst",
  "labels.synthetic": "Syntetiska exempeldata",
};
