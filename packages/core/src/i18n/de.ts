// DRAFT German strings: written by an AI assistant and NOT yet checked by a native speaker
// (non-negotiables 2, 5 and 9). Marked "draft" in I18N_STATUS; the guest app shows the
// "draft translation" label in demo mode, and a production build needs a native-speaker check.

import type { Strings } from "./index.ts";

export const de: Strings = {
  "app.name": "Ask Noor",

  "lang.title": "Sprache wählen",
  "lang.change": "Sprache ändern",
  "lang.en": "English",
  "lang.de": "Deutsch",
  "lang.nl": "Nederlands",
  "lang.sv": "Svenska",

  "nav.stops": "Stationen",
  "nav.ask": "Fragen",
  "nav.shop": "Hofladen",
  "nav.feedback": "Feedback",

  "common.close": "Schließen",
  "common.back": "Zurück",
  "common.loading": "Wird geladen …",
  "common.ok": "OK",

  "pack.title": "Farmführung herunterladen",
  "pack.body":
    "Laden Sie sie einmal herunter, solange Sie Empfang haben. Danach funktioniert die Führung ohne Internet.",
  "pack.size": "Downloadgröße: {size}",
  "pack.download": "Herunterladen",
  "pack.progress": "Wird heruntergeladen … {percent} %",
  "pack.retry": "Noch einmal versuchen",
  "pack.done": "Fertig. Die Führung funktioniert jetzt offline.",
  "pack.error":
    "Der Download wurde nicht abgeschlossen. Prüfen Sie Ihren Empfang und versuchen Sie es erneut.",
  "pack.storage":
    "Ihr Handy fragt möglicherweise, ob die Führung gespeichert bleiben darf. Bitte erlauben Sie das.",
  "pack.update": "Eine neuere Führung ist verfügbar. Aktualisieren Sie, sobald Sie Empfang haben.",

  "stops.title": "Stationen der Führung",
  "stops.stop": "Station {n}",
  "stops.scan": "Stationscode scannen",
  "stops.number": "Oder die Stationsnummer eingeben",
  "stops.numberLabel": "Stationsnummer",
  "stops.go": "Station öffnen",
  "stops.cameraDenied":
    "Die Kamera ist nicht verfügbar. Geben Sie stattdessen die Stationsnummer ein.",
  "stops.notFound":
    "Diese Station wurde nicht gefunden. Prüfen Sie die Nummer und versuchen Sie es erneut.",

  "player.play": "Abspielen",
  "player.pause": "Pause",
  "player.subtitles": "Untertitel",
  "player.noorSays": "Noors eigene Aufnahme",
  "player.sourceFallback": "Die Untertitel werden vorerst in Noors Sprache angezeigt.",

  "facts.title": "Wussten Sie schon?",
  "facts.source": "Quelle: {source}",
  "recipe.title": "Noors Rezept",
  "farm.title": "Über die Farm",
  "farm.contact":
    "Rufen Sie Noor an oder schreiben Sie ihr, um einen Besuch zu buchen oder mehr zu erfahren.",

  "ask.title": "Stellen Sie Noor eine Frage",
  "ask.placeholder": "Frage eingeben",
  "ask.submit": "Fragen",
  "ask.confirm": "Noor spricht über {topic}. Haben Sie das gefragt?",
  "ask.yes": "Ja, abspielen",
  "ask.no": "Nein",
  "ask.savedNo": "Danke. Wir haben Ihre Frage für Noor gespeichert.",
  "ask.saved.title": "Nicht sicher, fragen Sie eine Person",
  "ask.saved.body":
    "Wir konnten Ihre Frage keiner Aussage von Noor zuordnen. Wir haben sie für Noor gespeichert. Bitte fragen Sie Ihren Reiseleiter oder eine Person auf der Farm.",
  "ask.safety.title": "Bitte fragen Sie Ihren Reiseleiter",
  "ask.safety.body":
    "Bei Fragen zu Gesundheit, Sicherheit oder Notfällen suchen Sie bitte sofort Ihren Reiseleiter oder eine Person auf der Farm. Diese App kann bei Notfällen nicht helfen. Wir haben Ihre Frage nicht gespeichert.",

  "feedback.title": "Sagen Sie Noor, was Sie denken",
  "feedback.loved": "Was hat Ihnen gefallen?",
  "feedback.change": "Was würden Sie ändern?",
  "feedback.optional": "Freiwillig",
  "feedback.privacy": "Bitte schreiben Sie weder Ihren Namen noch Kontaktdaten.",
  "feedback.submit": "Senden",
  "feedback.thanks": "Danke! Noor erfährt davon.",

  "shop.title": "Hofladen",
  "shop.empty": "Ihr Korb ist leer.",
  "shop.qty": "Menge",
  "shop.total": "Gesamt: {total} {currency}",
  "shop.order": "Bestellen",
  "shop.showNoor": "Zeigen Sie das Noor",
  "shop.noorConfirms": "Noor bestätigt Ihre Zahlung persönlich.",
  "shop.noPayment": "In dieser App wird nichts bezahlt. Sie bezahlen Noor persönlich.",
  "shop.confirmed": "Noor hat Ihre Bestellung bestätigt.",

  "sync.pending": "{n} Einträge warten auf das Senden",
  "sync.done": "Alles ist gesendet.",
  "sync.offline": "Sie sind offline. Die Führung funktioniert trotzdem.",
  "sync.willSend": "Ihre Antworten werden gesendet, sobald Sie Empfang haben.",

  "labels.demo": "Demomodus",
  "labels.draftTranslation": "Entwurf einer Übersetzung, noch nicht geprüft",
  "labels.standIn": "Platzhalter: {what}",
  "labels.standInVoice": "Stimme: {person}, in Vertretung für Noor",
  "labels.aiVoice": "KI-Sprecherstimme",
  "labels.synthetic": "Synthetische Beispieldaten",
  "shop.codeLabel": "Noor: Gib deinen vierstelligen Farmcode ein",
  "shop.codeWrong": "Der Code stimmt nicht. Es wurde nichts gespeichert.",
  "shop.codeLocked": "Zu viele Versuche. Bitte {seconds} Sekunden warten.",
  "shop.codeMissing":
    "Diese Tour kann Bestellungen noch nicht bestätigen. Bitte frag Noor persönlich.",
  "labels.prototypeControl":
    "Prototyp-Kontrolle: Ein Farmcode ist nur eine Bremse, kein starker Schutz",
  "labels.aiDubbed": "KI-vertont",
};
