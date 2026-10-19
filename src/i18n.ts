import type { Field, Lang, Profile } from "../server/profile.ts";

type T = Record<Lang, string>;

export const UI = {
  tagline: { hi: "आप बोलेंगे, यह फ़ॉर्म अपने-आप भरेगा।", mr: "तुम्ही बोलाल तसा हा फॉर्म आपोआप भरेल.", en: "Speak, and this form fills itself in." },
  langButton: { hi: "हिंदी में बात करें", mr: "मराठीत बोला", en: "Talk in English" },
  formTitle: { hi: "आपकी जानकारी", mr: "तुमची माहिती", en: "Your details" },
  holdToSpeak: { hi: "दबाकर बोलिए", mr: "दाबून बोला", en: "Hold to speak" },
  listening: { hi: "सुन रही हूँ… छोड़ने पर भेजूँगी", mr: "ऐकत आहे… सोडल्यावर पाठवेन", en: "Listening… release to send" },
  tapToStop: { hi: "सुन रही हूँ… भेजने के लिए फिर दबाएँ", mr: "ऐकत आहे… पाठवण्यासाठी पुन्हा दाबा", en: "Listening… tap again to send" },
  thinking: { hi: "सोच रही हूँ…", mr: "विचार करत आहे…", en: "Thinking…" },
  speaking: { hi: "बोल रही हूँ · बीच में बोलने के लिए दबाएँ", mr: "बोलत आहे · मधेच बोलण्यासाठी दाबा", en: "Speaking · press to interrupt" },
  micLabel: { hi: "माइक", mr: "माइक", en: "Microphone" },
  youSaid: { hi: "आपने कहा", mr: "तुम्ही म्हणालात", en: "You said" },
  typeInstead: { hi: "लिखकर बताइए", mr: "लिहून सांगा", en: "Type instead" },
  typePlaceholder: { hi: "यहाँ लिखिए…", mr: "इथे लिहा…", en: "Type here…" },
  send: { hi: "भेजें", mr: "पाठवा", en: "Send" },
  startOver: { hi: "शुरू से", mr: "पुन्हा सुरू करा", en: "Start over" },
  eligible: { hi: "पात्र", mr: "पात्र", en: "Eligible" },
  likely: { hi: "संभावित", mr: "संभाव्य", en: "Likely" },
  documents: { hi: "ज़रूरी कागज़", mr: "लागणारी कागदपत्रे", en: "Documents" },
  listen: { hi: "सुनें", mr: "ऐका", en: "Listen" },
  officialSite: { hi: "आधिकारिक वेबसाइट", mr: "अधिकृत संकेतस्थळ", en: "Official website" },
  footer: {
    hi: "यह सरकारी ऐप नहीं है। अंतिम निर्णय संबंधित विभाग करता है।",
    mr: "हे सरकारी ॲप नाही. अंतिम निर्णय संबंधित विभाग घेतो.",
    en: "This is not a government app. The department concerned makes the final decision.",
  },
  micDenied: {
    hi: "माइक की अनुमति नहीं मिली। ब्राउज़र की सेटिंग में माइक चालू करें, या नीचे लिखकर बताइए।",
    mr: "माइकची परवानगी मिळाली नाही. ब्राउझर सेटिंगमध्ये माइक सुरू करा, किंवा खाली लिहून सांगा.",
    en: "Microphone access is blocked. Allow it in your browser settings, or type below.",
  },
} satisfies Record<string, T>;

export const ERRORS: Record<"limit" | "too_large" | "upstream" | "bad_request" | "network", T> = {
  limit: { hi: "अभी बहुत लोग इस्तेमाल कर रहे हैं। थोड़ी देर बाद फिर कोशिश करें।", mr: "सध्या खूप वापर सुरू आहे. थोड्या वेळाने पुन्हा प्रयत्न करा.", en: "Too many requests right now. Try again later." },
  too_large: { hi: "रिकॉर्डिंग बहुत लंबी है। छोटा करके बोलिए।", mr: "रेकॉर्डिंग खूप मोठं आहे. थोडक्यात बोला.", en: "That recording is too long. Keep it shorter." },
  upstream: { hi: "सर्वर से जवाब नहीं मिला। फिर से बोलिए।", mr: "सर्व्हरकडून उत्तर आलं नाही. पुन्हा बोला.", en: "The server didn't respond. Please say it again." },
  bad_request: { hi: "कुछ गड़बड़ हुई। शुरू से करें।", mr: "काहीतरी चुकलं. पुन्हा सुरू करा.", en: "Something went wrong. Start over." },
  network: { hi: "इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें।", mr: "इंटरनेट कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.", en: "Check your internet connection and try again." },
};

export function resultsHeadline(n: number, lang: Lang): string {
  if (n === 0) return { hi: "अभी कोई योजना नहीं मिली", mr: "सध्या कोणतीही योजना मिळाली नाही", en: "No matching scheme yet" }[lang];
  if (lang === "hi") return `आप ${n} ${n === 1 ? "योजना" : "योजनाओं"} के लिए पात्र हो सकते हैं`;
  if (lang === "mr") return `तुम्ही ${n} ${n === 1 ? "योजनेसाठी" : "योजनांसाठी"} पात्र असू शकता`;
  return `You may qualify for ${n} scheme${n === 1 ? "" : "s"}`;
}

export const FIELD_LABEL: Record<Field, T> = {
  age: { hi: "उम्र", mr: "वय", en: "Age" },
  gender: { hi: "लिंग", mr: "लिंग", en: "Gender" },
  state: { hi: "राज्य", mr: "राज्य", en: "State" },
  occupation: { hi: "काम", mr: "काम", en: "Work" },
  ownsFarmland: { hi: "ज़मीन अपने नाम", mr: "जमीन स्वतःच्या नावावर", en: "Land in own name" },
  annualFamilyIncome: { hi: "पारिवारिक आय", mr: "कौटुंबिक उत्पन्न", en: "Family income" },
  paysIncomeTax: { hi: "इनकम टैक्स", mr: "आयकर", en: "Income tax" },
  rationCard: { hi: "राशन कार्ड", mr: "रेशन कार्ड", en: "Ration card" },
  hasLpgConnection: { hi: "एलपीजी कनेक्शन", mr: "एलपीजी जोडणी", en: "LPG connection" },
  isPregnant: { hi: "गर्भवती", mr: "गर्भवती", en: "Pregnant" },
  daughterAges: { hi: "बेटियों की उम्र", mr: "मुलींचे वय", en: "Daughters' ages" },
};

const VALUE: Record<string, T> = {
  male: { hi: "पुरुष", mr: "पुरुष", en: "Man" },
  female: { hi: "महिला", mr: "महिला", en: "Woman" },
  other: { hi: "अन्य", mr: "इतर", en: "Other" },
  farmer: { hi: "किसान", mr: "शेतकरी", en: "Farmer" },
  street_vendor: { hi: "रेहड़ी-पटरी", mr: "फेरीवाला", en: "Street vendor" },
  artisan: { hi: "कारीगर", mr: "कारागीर", en: "Artisan" },
  daily_wage: { hi: "मज़दूरी", mr: "मजुरी", en: "Daily wage" },
  govt_job: { hi: "सरकारी नौकरी", mr: "सरकारी नोकरी", en: "Government job" },
  private_job: { hi: "प्राइवेट नौकरी", mr: "खाजगी नोकरी", en: "Private job" },
  homemaker: { hi: "गृहिणी", mr: "गृहिणी", en: "Homemaker" },
  student: { hi: "विद्यार्थी", mr: "विद्यार्थी", en: "Student" },
  none: { hi: "कोई नहीं", mr: "नाही", en: "None" },
  yellow: { hi: "पीला", mr: "पिवळे", en: "Yellow" },
  orange: { hi: "केसरी", mr: "केशरी", en: "Orange" },
  white: { hi: "सफ़ेद", mr: "पांढरे", en: "White" },
  true: { hi: "हाँ", mr: "हो", en: "Yes" },
  false: { hi: "नहीं", mr: "नाही", en: "No" },
};

// shortcut: only the likeliest states get a Devanagari name; others show the English name the LLM returns
const STATE_DEVANAGARI: Record<string, string> = {
  maharashtra: "महाराष्ट्र", gujarat: "गुजरात", karnataka: "कर्नाटक", goa: "गोवा", "madhya pradesh": "मध्य प्रदेश",
  "uttar pradesh": "उत्तर प्रदेश", bihar: "बिहार", rajasthan: "राजस्थान", telangana: "तेलंगाना", delhi: "दिल्ली",
};

const YEARS: T = { hi: "साल", mr: "वर्षे", en: "years" };
const PER_YEAR: T = { hi: "/साल", mr: "/वर्ष", en: "/year" };

/** How a profile value is written into the form. */
export function formatValue<F extends Field>(field: F, value: NonNullable<Profile[F]>, lang: Lang): string {
  if (field === "age") return `${value} ${YEARS[lang]}`;
  if (field === "annualFamilyIncome") return `₹${(value as number).toLocaleString("en-IN")}${PER_YEAR[lang]}`;
  if (field === "state") return (lang !== "en" && STATE_DEVANAGARI[(value as string).trim().toLowerCase()]) || (value as string);
  if (field === "daughterAges") {
    const ages = value as number[];
    return ages.length ? `${ages.join(", ")} ${YEARS[lang]}` : VALUE.none[lang];
  }
  return VALUE[String(value)]?.[lang] ?? String(value);
}
