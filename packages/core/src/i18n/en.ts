// English interface strings: the source text. Every guest-facing string of the interface lives
// here (PRD section 6, journeys 2 to 6, and FR-01 to FR-10, GR-8). Guests see only fixed text like
// this, Noor's recordings and checked subtitles (non-negotiable 2); nothing here is generated.
//
// Not here on purpose: the emergency number. It is a content item for Preet, so the safety card
// sends guests to their guide and gives no medical advice.
//
// Placeholders are written {name}; every language must use the same set per key (i18n.test.ts).

export const en = {
  "app.name": "Ask Noor",

  "lang.title": "Choose your language",
  "lang.change": "Change language",
  "lang.en": "English",
  "lang.de": "Deutsch",
  "lang.nl": "Nederlands",
  "lang.sv": "Svenska",

  "nav.stops": "Stops",
  "nav.ask": "Ask",
  "nav.shop": "Shop",
  "nav.feedback": "Feedback",

  "common.close": "Close",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.ok": "OK",

  "pack.title": "Download the farm tour",
  "pack.body":
    "Download once while you have a signal. After that, the tour works without internet.",
  "pack.size": "Download size: {size}",
  "pack.download": "Download",
  "pack.progress": "Downloading… {percent}%",
  "pack.retry": "Try again",
  "pack.done": "Ready. The tour now works offline.",
  "pack.error": "The download did not finish. Check your signal and try again.",
  "pack.storage": "Your phone may ask to keep the tour saved. Please allow it.",
  "pack.update": "A newer tour is available. Update when you have a signal.",

  "stops.title": "Tour stops",
  "stops.stop": "Stop {n}",
  "stops.scan": "Scan a stop code",
  "stops.number": "Or enter the stop number",
  "stops.numberLabel": "Stop number",
  "stops.go": "Open stop",
  "stops.cameraDenied": "The camera is not available. Enter the stop number instead.",
  "stops.notFound": "We could not find that stop. Check the number and try again.",

  "player.play": "Play",
  "player.pause": "Pause",
  "player.subtitles": "Subtitles",
  "player.noorSays": "Noor's own recording",
  "player.sourceFallback": "Subtitles are shown in Noor's language for now.",

  "facts.title": "Did you know?",
  "facts.source": "Source: {source}",
  "recipe.title": "Noor's recipe",
  "farm.title": "About the farm",
  "farm.contact": "Call or text Noor to book a visit or to ask more.",

  "ask.title": "Ask Noor a question",
  "ask.placeholder": "Type your question",
  "ask.submit": "Ask",
  "ask.confirm": "Noor talks about {topic}. Is this what you asked?",
  "ask.yes": "Yes, play it",
  "ask.no": "No",
  "ask.savedNo": "Thank you. We saved your question for Noor.",
  "ask.saved.title": "Not sure, ask a person",
  "ask.saved.body":
    "We could not match your question to something Noor said. We saved it for Noor. Please ask your guide or a person on the farm.",
  "ask.safety.title": "Please ask your guide",
  "ask.safety.body":
    "For health, safety or emergency questions, please find your guide or a person on the farm right away. This app cannot help with emergencies. We did not save your question.",

  "feedback.title": "Tell Noor what you think",
  "feedback.loved": "What did you love?",
  "feedback.change": "What would you change?",
  "feedback.optional": "Optional",
  "feedback.privacy": "Please do not write your name or contact details.",
  "feedback.submit": "Send",
  "feedback.thanks": "Thank you! Noor will hear about it.",

  "shop.title": "Shop",
  "shop.empty": "Your basket is empty.",
  "shop.qty": "Quantity",
  "shop.total": "Total: {total} {currency}",
  "shop.order": "Order",
  "shop.showNoor": "Show this to Noor",
  "shop.noorConfirms": "Noor confirms your payment in person.",
  "shop.noPayment": "No payment is taken in this app. You pay Noor in person.",
  "shop.confirmed": "Noor confirmed your order.",

  "sync.pending": "{n} items waiting to be sent",
  "sync.done": "Everything is sent.",
  "sync.offline": "You are offline. The tour still works.",
  "sync.willSend": "Your answers will be sent when you have a signal.",

  "labels.demo": "Demo mode",
  "labels.draftTranslation": "Draft translation, not yet checked",
  "labels.standIn": "Stand-in: {what}",
  "labels.standInVoice": "Voice: {person}, standing in for Noor",
  "labels.aiVoice": "AI narrator voice",
  "labels.synthetic": "Synthetic example data",
} as const;
