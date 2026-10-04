// DRAFT Dutch strings: written by an AI assistant and NOT yet checked by a native speaker
// (non-negotiables 2, 5 and 9). Marked "draft" in I18N_STATUS; the guest app shows the
// "draft translation" label in demo mode, and a production build needs a native-speaker check.

import type { Strings } from "./index.ts";

export const nl: Strings = {
  "app.name": "Ask Noor",

  "lang.title": "Kies je taal",
  "lang.change": "Taal wijzigen",
  "lang.en": "English",
  "lang.de": "Deutsch",
  "lang.nl": "Nederlands",
  "lang.sv": "Svenska",

  "nav.stops": "Stops",
  "nav.ask": "Vragen",
  "nav.shop": "Winkel",
  "nav.feedback": "Feedback",

  "common.close": "Sluiten",
  "common.back": "Terug",
  "common.loading": "Laden…",
  "common.ok": "OK",

  "pack.title": "Download de rondleiding",
  "pack.body":
    "Download één keer, zolang je bereik hebt. Daarna werkt de rondleiding zonder internet.",
  "pack.size": "Downloadgrootte: {size}",
  "pack.download": "Downloaden",
  "pack.progress": "Downloaden… {percent}%",
  "pack.retry": "Probeer het opnieuw",
  "pack.done": "Klaar. De rondleiding werkt nu offline.",
  "pack.error": "De download is niet afgerond. Controleer je bereik en probeer het opnieuw.",
  "pack.storage":
    "Je telefoon vraagt misschien of de rondleiding bewaard mag blijven. Sta dat alsjeblieft toe.",
  "pack.update": "Er is een nieuwere rondleiding. Werk bij zodra je bereik hebt.",

  "stops.title": "Stops van de rondleiding",
  "stops.stop": "Stop {n}",
  "stops.scan": "Scan een stopcode",
  "stops.number": "Of voer het stopnummer in",
  "stops.numberLabel": "Stopnummer",
  "stops.go": "Stop openen",
  "stops.cameraDenied": "De camera is niet beschikbaar. Voer in plaats daarvan het stopnummer in.",
  "stops.notFound": "We konden die stop niet vinden. Controleer het nummer en probeer het opnieuw.",

  "player.play": "Afspelen",
  "player.pause": "Pauzeren",
  "player.subtitles": "Ondertitels",
  "player.noorSays": "Noors eigen opname",
  "player.sourceFallback": "De ondertitels staan voorlopig in de taal van Noor.",

  "facts.title": "Wist je dat?",
  "facts.source": "Bron: {source}",
  "recipe.title": "Noors recept",
  "farm.title": "Over de boerderij",
  "farm.contact": "Bel of sms Noor om een bezoek te boeken of meer te vragen.",

  "ask.title": "Stel Noor een vraag",
  "ask.placeholder": "Typ je vraag",
  "ask.submit": "Vragen",
  "ask.confirm": "Noor vertelt over {topic}. Is dit wat je vroeg?",
  "ask.yes": "Ja, afspelen",
  "ask.no": "Nee",
  "ask.savedNo": "Bedankt. We hebben je vraag voor Noor bewaard.",
  "ask.saved.title": "Niet zeker, vraag het een persoon",
  "ask.saved.body":
    "We konden je vraag niet koppelen aan iets wat Noor heeft gezegd. We hebben hem voor Noor bewaard. Vraag het alsjeblieft je gids of een persoon op de boerderij.",
  "ask.safety.title": "Vraag het je gids",
  "ask.safety.body":
    "Bij vragen over gezondheid, veiligheid of noodgevallen: zoek meteen je gids of een persoon op de boerderij. Deze app kan niet helpen bij noodgevallen. We hebben je vraag niet bewaard.",

  "feedback.title": "Vertel Noor wat je vindt",
  "feedback.loved": "Wat vond je geweldig?",
  "feedback.change": "Wat zou je veranderen?",
  "feedback.optional": "Optioneel",
  "feedback.privacy": "Schrijf alsjeblieft geen naam of contactgegevens op.",
  "feedback.submit": "Verzenden",
  "feedback.thanks": "Bedankt! Noor krijgt het te horen.",

  "shop.title": "Winkel",
  "shop.empty": "Je mandje is leeg.",
  "shop.qty": "Aantal",
  "shop.total": "Totaal: {total} {currency}",
  "shop.order": "Bestellen",
  "shop.showNoor": "Laat dit aan Noor zien",
  "shop.noorConfirms": "Noor bevestigt je betaling persoonlijk.",
  "shop.noPayment": "In deze app wordt niets betaald. Je betaalt Noor persoonlijk.",
  "shop.confirmed": "Noor heeft je bestelling bevestigd.",

  "sync.pending": "{n} items wachten om verzonden te worden",
  "sync.done": "Alles is verzonden.",
  "sync.offline": "Je bent offline. De rondleiding werkt nog steeds.",
  "sync.willSend": "Je antwoorden worden verzonden zodra je bereik hebt.",

  "labels.demo": "Demomodus",
  "labels.draftTranslation": "Conceptvertaling, nog niet gecontroleerd",
  "labels.standIn": "Plaatsvervanger: {what}",
  "labels.standInVoice": "Stem: {person}, ter vervanging van Noor",
  "labels.aiVoice": "AI-verteller",
  "labels.synthetic": "Synthetische voorbeeldgegevens",
  "shop.codeLabel": "Noor: voer je viercijferige boerderijcode in",
  "shop.codeWrong": "Die code klopt niet. Er is niets opgeslagen.",
  "shop.codeLocked": "Te veel pogingen. Wacht {seconds} seconden.",
  "shop.codeMissing": "Deze tour kan bestellingen nog niet bevestigen. Vraag het Noor persoonlijk.",
  "labels.prototypeControl":
    "Prototypecontrole: een boerderijcode is slechts een drempel, geen sterke beveiliging",
  "labels.aiDubbed": "AI-gedubd",
};
