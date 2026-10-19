// Everything the app says aloud, except LLM acknowledgements. Imported by the browser too: no Node-only imports.
import { FIELDS } from "./profile.ts";
import type { Field, Lang } from "./profile.ts";
import type { RuleResult, SchemeText } from "./schemes.ts";

type Texts = Record<Lang, string>;

/** Ask for the fact the most undecided schemes are waiting on; ties go to FIELDS order. */
export function pickNextField(results: RuleResult[], asked: Field[]): Field | null {
  const waiting = new Map<Field, number>();
  for (const r of results) if (r.status === "needs") for (const f of r.fields) waiting.set(f, (waiting.get(f) ?? 0) + 1);
  let best: Field | null = null;
  for (const f of FIELDS) {
    if (asked.filter((a) => a === f).length >= 2) continue; // asked twice already: don't loop on it
    if ((waiting.get(f) ?? 0) > (best ? waiting.get(best)! : 0)) best = f;
  }
  return best;
}

// Hindi lines use feminine first-person forms because the voice (Shivani) is female.
export const QUESTIONS: Record<Field, Texts> = {
  age: { hi: "आपकी उम्र कितनी है?", mr: "तुमचं वय किती आहे?", en: "How old are you?" },
  gender: { hi: "आप महिला हैं या पुरुष?", mr: "तुम्ही महिला आहात की पुरुष?", en: "Are you a woman or a man?" },
  state: { hi: "आप किस राज्य में रहते हैं?", mr: "तुम्ही कोणत्या राज्यात राहता?", en: "Which state do you live in?" },
  occupation: {
    hi: "आप क्या काम करते हैं? जैसे खेती, ठेला, कारीगरी, मज़दूरी या घर का काम?",
    mr: "तुम्ही काय काम करता? उदा. शेती, फेरीवाला, कारागिरी, मजुरी किंवा घरकाम?",
    en: "What work do you do? For example farming, street vending, a craft, daily wage work or home-making?",
  },
  ownsFarmland: { hi: "क्या खेती की ज़मीन आपके नाम पर है?", mr: "शेतजमीन तुमच्या नावावर आहे का?", en: "Is the farmland in your own name?" },
  annualFamilyIncome: {
    hi: "पूरे परिवार की सालाना कमाई लगभग कितनी है?",
    mr: "संपूर्ण कुटुंबाचं वार्षिक उत्पन्न साधारण किती आहे?",
    en: "Roughly how much does your whole family earn per year?",
  },
  paysIncomeTax: { hi: "क्या आप इनकम टैक्स भरते हैं?", mr: "तुम्ही आयकर भरता का?", en: "Do you pay income tax?" },
  rationCard: {
    hi: "आपका राशन कार्ड किस रंग का है: पीला, केसरी, सफ़ेद, या कोई नहीं?",
    mr: "तुमचं रेशन कार्ड कोणत्या रंगाचं आहे: पिवळं, केशरी, पांढरं, की नाही?",
    en: "What colour is your ration card: yellow, orange, white, or none?",
  },
  hasLpgConnection: { hi: "क्या आपके घर में एलपीजी गैस कनेक्शन है?", mr: "तुमच्या घरी एलपीजी गॅस जोडणी आहे का?", en: "Does your home have an LPG gas connection?" },
  isPregnant: { hi: "क्या आप अभी गर्भवती हैं?", mr: "तुम्ही सध्या गर्भवती आहात का?", en: "Are you pregnant right now?" },
  daughterAges: {
    hi: "क्या आपकी बेटियाँ हैं? हों तो उनकी उम्र बताइए।",
    mr: "तुम्हाला मुली आहेत का? असल्यास त्यांचं वय सांगा.",
    en: "Do you have daughters? If yes, how old are they?",
  },
};

export const GREETING: Texts = {
  hi: "नमस्ते! मैं सरकारी साथी हूँ। अपने बारे में बताइए: उम्र, काम, और आप कहाँ रहते हैं?",
  mr: "नमस्कार! मी सरकारी साथी. तुमच्याबद्दल सांगा: वय, काम, आणि तुम्ही कुठे राहता?",
  en: "Hello! I'm Sarkari Saathi. Tell me about yourself: your age, your work, and where you live.",
};

export const SAY_AGAIN: Texts = {
  hi: "माफ़ कीजिए, मैं ठीक से सुन नहीं पाई। कृपया फिर से बोलिए।",
  mr: "माफ करा, मला नीट ऐकू आलं नाही. कृपया पुन्हा सांगा.",
  en: "Sorry, I didn't catch that. Please say it again.",
};

export const NO_MATCH: Texts = {
  hi: "आपकी बताई जानकारी से अभी कोई योजना नहीं मिली। नज़दीकी CSC केंद्र पर और योजनाओं के बारे में पूछें।",
  mr: "तुम्ही दिलेल्या माहितीनुसार सध्या कोणतीही योजना मिळाली नाही. जवळच्या CSC केंद्रात आणखी योजनांबद्दल विचारा.",
  en: "From what you told me, I couldn't find a matching scheme yet. Ask at your nearest CSC centre about other schemes.",
};

export const MISSING_NOTE: Texts = {
  hi: "कुछ जानकारी बाकी है; पात्रता की पुष्टि दफ़्तर में करें।",
  mr: "काही माहिती बाकी आहे; पात्रतेची खात्री कार्यालयात करा.",
  en: "Some details are missing; confirm eligibility at the office.",
};

export function resultsSummary(lang: Lang, names: string[]): string {
  const n = names.length;
  if (n === 0) return NO_MATCH[lang];
  const list = names.join(", ");
  if (lang === "hi") return n === 1
    ? `आप इस योजना के लिए पात्र हो सकते हैं: ${list}। पूरी जानकारी स्क्रीन पर है।`
    : `आप इन ${n} योजनाओं के लिए पात्र हो सकते हैं: ${list}। पूरी जानकारी स्क्रीन पर है।`;
  if (lang === "mr") return n === 1
    ? `तुम्ही या योजनेसाठी पात्र असू शकता: ${list}. सविस्तर माहिती स्क्रीनवर आहे.`
    : `तुम्ही या ${n} योजनांसाठी पात्र असू शकता: ${list}. सविस्तर माहिती स्क्रीनवर आहे.`;
  return `You may be eligible for ${n} scheme${n === 1 ? "" : "s"}: ${list}. The details are on your screen.`;
}

const DOCS_LABEL: Texts = { hi: "ज़रूरी कागज़", mr: "लागणारी कागदपत्रे", en: "Documents needed" };

/** What the 🔊 button on a scheme card reads aloud. */
export function cardSpeech(text: SchemeText, lang: Lang): string {
  const stop = lang === "hi" ? "।" : ".";
  return `${text.name}${stop} ${text.benefit} ${DOCS_LABEL[lang]}: ${text.documents.join(", ")}${stop}`;
}
