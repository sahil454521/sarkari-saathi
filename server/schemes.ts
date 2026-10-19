import type { Field, Lang, Profile } from "./profile.ts";

export type RuleResult =
  | { status: "eligible" }
  | { status: "likely"; note: Record<Lang, string> }
  | { status: "no" }
  | { status: "needs"; fields: Field[] };

export type SchemeText = { name: string; benefit: string; documents: string[] };

export interface Scheme {
  id: string;
  text: Record<Lang, SchemeText>;
  url: string;
  source: string;
  checkedOn: string;
  check(p: Profile): RuleResult;
}

export type SchemeCard = {
  id: string; status: "eligible" | "likely"; name: string; benefit: string; documents: string[]; url: string; note?: string;
};

type Conds = Partial<Record<Field, (v: any) => boolean>>;

/** "no" if a known fact fails a condition; otherwise the fields still unknown (empty = all met). */
function criteria(p: Profile, conds: Conds): "no" | Field[] {
  const unknown: Field[] = [];
  for (const [field, ok] of Object.entries(conds) as [Field, (v: any) => boolean][]) {
    if (p[field] === undefined) unknown.push(field);
    else if (!ok(p[field])) return "no";
  }
  return unknown;
}

function decide(r: "no" | Field[], outcome: () => RuleResult): RuleResult {
  if (r === "no") return { status: "no" };
  return r.length ? { status: "needs", fields: r } : outcome();
}

const ELIGIBLE: RuleResult = { status: "eligible" };
const likely = (note: Record<Lang, string>): RuleResult => ({ status: "likely", note });

const inMaharashtra = (s: string) => s.trim().toLowerCase() === "maharashtra";
const poorCard = (c: string) => c === "yellow" || c === "orange";
const CHECKED = "2026-10-19";

const PM_KISAN: Conds = { occupation: (o) => o === "farmer", ownsFarmland: (v) => v === true, paysIncomeTax: (v) => v === false };
// Criteria we don't ask about (land date, family exclusions) keep PM-KISAN at "likely" (spec §8).
const PM_KISAN_NOTE: Record<Lang, string> = {
  en: "The land must have been in your family's name by 1 February 2019 (after that, only by inheritance). Families with an income-tax payer, a government employee, a pensioner on ₹10,000+ a month or a registered professional are excluded.",
  hi: "ज़मीन 1 फ़रवरी 2019 तक परिवार के नाम होनी चाहिए (उसके बाद सिर्फ़ विरासत से)। जिस परिवार में कोई इनकम टैक्स भरता हो, सरकारी कर्मचारी हो, ₹10,000+ मासिक पेंशन पाता हो या डॉक्टर, वकील जैसा पंजीकृत पेशेवर हो, उसे यह नहीं मिलता।",
  mr: "जमीन 1 फेब्रुवारी 2019 पर्यंत कुटुंबाच्या नावावर असावी (त्यानंतर फक्त वारसाने). कुटुंबात आयकर भरणारे, सरकारी कर्मचारी, ₹10,000+ मासिक पेन्शनधारक किंवा डॉक्टर, वकील असे नोंदणीकृत व्यावसायिक असल्यास योजना मिळत नाही.",
};

export const SCHEMES: Scheme[] = [
  {
    id: "pm-kisan",
    url: "https://pmkisan.gov.in",
    source: "https://pmkisan.gov.in/Documents/RevisedFAQ.pdf",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, PM_KISAN), () => likely(PM_KISAN_NOTE)),
    text: {
      en: { name: "PM-KISAN", benefit: "₹6,000 a year straight into your bank account, in three instalments of ₹2,000.",
        documents: ["Aadhaar card", "Land record (7/12 extract)", "Bank passbook"] },
      hi: { name: "पीएम-किसान सम्मान निधि", benefit: "हर साल ₹6,000 सीधे आपके बैंक खाते में, ₹2,000 की तीन किस्तों में।",
        documents: ["आधार कार्ड", "ज़मीन के कागज़ (7/12 उतारा)", "बैंक पासबुक"] },
      mr: { name: "पीएम-किसान सन्मान निधी", benefit: "दरवर्षी ₹6,000 थेट तुमच्या बँक खात्यात, ₹2,000 च्या तीन हप्त्यांत.",
        documents: ["आधार कार्ड", "जमिनीचा 7/12 उतारा", "बँक पासबुक"] },
    },
  },
  {
    id: "namo-shetkari",
    url: "https://nsmny.mahait.org",
    source: "https://en.vikaspedia.in/viewcontent/schemesall/state-specific-schemes/welfare-schemes-of-maharashtra/namo-shetkari-maha-samman-nidhi-yojana?lgn=en",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { ...PM_KISAN, state: inMaharashtra }), () => likely({
      en: "Paid automatically to PM-KISAN beneficiaries in Maharashtra, so the PM-KISAN conditions apply.",
      hi: "महाराष्ट्र के पीएम-किसान लाभार्थियों को अपने-आप मिलता है, इसलिए पीएम-किसान की शर्तें लागू हैं।",
      mr: "महाराष्ट्रातील पीएम-किसान लाभार्थ्यांना आपोआप मिळते, त्यामुळे पीएम-किसानच्या अटी लागू आहेत.",
    })),
    text: {
      en: { name: "Namo Shetkari Mahasanman Nidhi", benefit: "Another ₹6,000 a year from Maharashtra on top of PM-KISAN, with no separate form.",
        documents: ["Aadhaar card", "PM-KISAN registration", "Aadhaar-linked bank account"] },
      hi: { name: "नमो शेतकरी महासन्मान निधि", benefit: "पीएम-किसान के ऊपर महाराष्ट्र सरकार से हर साल ₹6,000 और, अलग फ़ॉर्म की ज़रूरत नहीं।",
        documents: ["आधार कार्ड", "पीएम-किसान पंजीकरण", "आधार से जुड़ा बैंक खाता"] },
      mr: { name: "नमो शेतकरी महासन्मान निधी", benefit: "पीएम-किसानच्या वर महाराष्ट्र शासनाकडून दरवर्षी आणखी ₹6,000, वेगळा अर्ज लागत नाही.",
        documents: ["आधार कार्ड", "पीएम-किसान नोंदणी", "आधारशी जोडलेले बँक खाते"] },
    },
  },
  {
    id: "pmfby",
    url: "https://pmfby.gov.in",
    source: "https://sribhumi.assam.gov.in/index.php/scheme-page/pradhan-mantri-fasal-bima-yojana-pmfby",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { occupation: (o) => o === "farmer" }), () => likely({
      en: "Only for crops notified in your area this season; enrol at a bank or CSC before the deadline.",
      hi: "सिर्फ़ उन फसलों के लिए जो इस सीज़न आपके इलाके में अधिसूचित हैं; आख़िरी तारीख से पहले बैंक या CSC पर नाम दर्ज कराएँ।",
      mr: "फक्त या हंगामात तुमच्या भागात अधिसूचित पिकांसाठी; अंतिम तारखेपूर्वी बँक किंवा CSC मध्ये नोंदणी करा.",
    })),
    text: {
      en: { name: "PM Fasal Bima Yojana (crop insurance)", benefit: "Low-premium insurance for your crop against drought, flood, pests and other losses.",
        documents: ["Aadhaar card", "Land record or tenancy agreement", "Bank passbook", "Sowing declaration"] },
      hi: { name: "प्रधानमंत्री फसल बीमा योजना", benefit: "कम प्रीमियम पर फसल का बीमा, सूखा, बाढ़ और कीट जैसे नुकसान से सुरक्षा।",
        documents: ["आधार कार्ड", "ज़मीन के कागज़ या बटाई का समझौता", "बैंक पासबुक", "बुवाई का प्रमाण"] },
      mr: { name: "प्रधानमंत्री पीक विमा योजना", benefit: "कमी हप्त्यात पिकाचा विमा, दुष्काळ, पूर आणि कीड यांसारख्या नुकसानीपासून संरक्षण.",
        documents: ["आधार कार्ड", "जमिनीचा उतारा किंवा कुळाचा करार", "बँक पासबुक", "पेरणीचे स्वयंघोषणापत्र"] },
    },
  },
  {
    id: "pm-jay",
    url: "https://beneficiary.nha.gov.in",
    source: "https://rsdebate.nic.in/bitstream/123456789/758871/1/PQ_267_11022025_U903_p367_p370.pdf",
    checkedOn: CHECKED,
    check: (p) => {
      if (p.age === undefined) return { status: "needs", fields: ["age"] };
      if (p.age >= 70) return ELIGIBLE; // Ayushman Vay Vandana: every 70+ citizen, regardless of income
      return decide(criteria(p, { rationCard: poorCard }), () => likely({
        en: "Your family's name must be on the beneficiary list; check at beneficiary.nha.gov.in or the nearest CSC.",
        hi: "परिवार का नाम लाभार्थी सूची में होना चाहिए; beneficiary.nha.gov.in या नज़दीकी CSC पर जाँचें।",
        mr: "कुटुंबाचे नाव लाभार्थी यादीत असणे आवश्यक; beneficiary.nha.gov.in किंवा जवळच्या CSC मध्ये तपासा.",
      }));
    },
    text: {
      en: { name: "Ayushman Bharat PM-JAY", benefit: "Free hospital treatment up to ₹5 lakh a year per family at listed hospitals.",
        documents: ["Aadhaar card", "Ration card"] },
      hi: { name: "आयुष्मान भारत (पीएम-जय)", benefit: "सूचीबद्ध अस्पतालों में हर परिवार को साल में ₹5 लाख तक का मुफ़्त इलाज।",
        documents: ["आधार कार्ड", "राशन कार्ड"] },
      mr: { name: "आयुष्मान भारत (पीएम-जय)", benefit: "यादीतील रुग्णालयांत प्रत्येक कुटुंबाला वर्षाला ₹5 लाखांपर्यंत मोफत उपचार.",
        documents: ["आधार कार्ड", "रेशन कार्ड"] },
    },
  },
  {
    id: "mjpjay",
    url: "https://www.jeevandayee.gov.in",
    source: "https://www.zpsatara.gov.in/?p=8986",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { state: inMaharashtra, rationCard: () => true }), () =>
      poorCard(p.rationCard!) ? ELIGIBLE : likely({
        en: "White-card and domicile-certificate families were added recently; confirm with the Arogya Mitra at a listed hospital.",
        hi: "सफ़ेद राशन कार्ड और अधिवास प्रमाणपत्र वाले परिवार हाल ही में जोड़े गए हैं; सूचीबद्ध अस्पताल में आरोग्य मित्र से पुष्टि करें।",
        mr: "पांढरे रेशन कार्ड व अधिवास प्रमाणपत्र असलेली कुटुंबे नुकतीच समाविष्ट झाली आहेत; अंगीकृत रुग्णालयातील आरोग्य मित्राकडे खात्री करा.",
      })),
    text: {
      en: { name: "Mahatma Jyotiba Phule Jan Arogya Yojana", benefit: "Cashless treatment up to ₹5 lakh a year per family at listed hospitals in Maharashtra.",
        documents: ["Ration card or Maharashtra domicile certificate", "Aadhaar card"] },
      hi: { name: "महात्मा ज्योतिबा फुले जन आरोग्य योजना", benefit: "महाराष्ट्र के सूचीबद्ध अस्पतालों में हर परिवार को साल में ₹5 लाख तक कैशलेस इलाज।",
        documents: ["राशन कार्ड या महाराष्ट्र अधिवास प्रमाणपत्र", "आधार कार्ड"] },
      mr: { name: "महात्मा ज्योतिराव फुले जन आरोग्य योजना", benefit: "महाराष्ट्रातील अंगीकृत रुग्णालयांत प्रत्येक कुटुंबाला वर्षाला ₹5 लाखांपर्यंत कॅशलेस उपचार.",
        documents: ["रेशन कार्ड किंवा महाराष्ट्र अधिवास प्रमाणपत्र", "आधार कार्ड"] },
    },
  },
  {
    id: "ujjwala",
    url: "https://www.pmuy.gov.in",
    source: "https://www.publicservicesmap.in/schemes/pradhan-mantri-ujjwala-yojana-2-0--pmuy2",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, {
      gender: (g) => g === "female", age: (a) => a >= 18, hasLpgConnection: (v) => v === false, rationCard: poorCard,
    }), () => likely({
      en: "The gas distributor confirms your household's category (SC/ST, Antyodaya, PM Awas or a poverty self-declaration).",
      hi: "गैस वितरक आपके परिवार की श्रेणी (SC/ST, अंत्योदय, पीएम आवास या गरीबी का स्व-घोषणा पत्र) की पुष्टि करता है।",
      mr: "गॅस वितरक तुमच्या कुटुंबाच्या प्रवर्गाची (SC/ST, अंत्योदय, पीएम आवास किंवा गरिबीचे स्वयंघोषणापत्र) खात्री करतो.",
    })),
    text: {
      en: { name: "PM Ujjwala Yojana", benefit: "A free LPG gas connection for women from poor households, with the first refill and a stove.",
        documents: ["Aadhaar card", "Ration card", "Bank passbook"] },
      hi: { name: "प्रधानमंत्री उज्ज्वला योजना", benefit: "गरीब परिवारों की महिलाओं को मुफ़्त एलपीजी गैस कनेक्शन, पहली रिफ़िल और चूल्हे के साथ।",
        documents: ["आधार कार्ड", "राशन कार्ड", "बैंक पासबुक"] },
      mr: { name: "प्रधानमंत्री उज्ज्वला योजना", benefit: "गरीब कुटुंबातील महिलांना मोफत एलपीजी गॅस जोडणी, पहिल्या रिफिल आणि शेगडीसह.",
        documents: ["आधार कार्ड", "रेशन कार्ड", "बँक पासबुक"] },
    },
  },
  {
    id: "pmmvy",
    url: "https://pmmvy.wcd.gov.in",
    source: "https://www.publicservicesmap.in/schemes/pradhan-mantri-matru-vandana-yojana--pmmvy?lang=en",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, {
      gender: (g) => g === "female", age: (a) => a >= 18 && a <= 50, isPregnant: (v) => v === true,
      occupation: (o) => o !== "govt_job", annualFamilyIncome: (i) => i < 800000,
    }), () => likely({
      en: "Register at your Anganwadi centre; it is for the first child, or the second if she is a girl.",
      hi: "अपने आंगनवाड़ी केंद्र पर पंजीकरण कराएँ; यह पहले बच्चे के लिए है, या दूसरी संतान बेटी हो तो।",
      mr: "तुमच्या अंगणवाडी केंद्रात नोंदणी करा; हे पहिल्या अपत्यासाठी आहे, किंवा दुसरी मुलगी असल्यास.",
    })),
    text: {
      en: { name: "PM Matru Vandana Yojana", benefit: "₹5,000 for pregnant women for the first child, or ₹6,000 if the second child is a girl, paid to your bank account.",
        documents: ["Aadhaar card", "Mother and child protection (MCP) card", "Bank passbook"] },
      hi: { name: "प्रधानमंत्री मातृ वंदना योजना", benefit: "गर्भवती महिलाओं को पहले बच्चे पर ₹5,000, या दूसरी संतान बेटी हो तो ₹6,000, सीधे बैंक खाते में।",
        documents: ["आधार कार्ड", "एमसीपी (माँ-बच्चा सुरक्षा) कार्ड", "बैंक पासबुक"] },
      mr: { name: "प्रधानमंत्री मातृ वंदना योजना", benefit: "गर्भवती महिलांना पहिल्या अपत्यासाठी ₹5,000, किंवा दुसरी मुलगी असल्यास ₹6,000, थेट बँक खात्यात.",
        documents: ["आधार कार्ड", "एमसीपी (माता-बाल संरक्षण) कार्ड", "बँक पासबुक"] },
    },
  },
  {
    id: "ladki-bahin",
    url: "https://ladakibahin.maharashtra.gov.in",
    source: "https://pune.gov.in/scheme/mukhyamantri-majhi-ladki-bahin-yojana/",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, {
      state: inMaharashtra, gender: (g) => g === "female", age: (a) => a >= 21 && a <= 65,
      annualFamilyIncome: (i) => i <= 250000, paysIncomeTax: (v) => v === false, occupation: (o) => o !== "govt_job",
    }), () => likely({
      // Offset reported since April 2025 (Scroll, Business Today): Namo Shetkari women get only the ₹500 top-up.
      en: "If you already get Namo Shetkari or another state benefit, you receive only the top-up to ₹1,500 (₹500 for Namo Shetkari farmers). Families with a four-wheeler or a government employee are excluded.",
      hi: "अगर आपको पहले से नमो शेतकरी या कोई दूसरी राज्य सहायता मिलती है, तो सिर्फ़ ₹1,500 तक की बाकी रकम मिलती है (नमो शेतकरी किसानों को ₹500)। जिस परिवार के पास चार-पहिया गाड़ी हो या कोई सरकारी कर्मचारी हो, उसे यह नहीं मिलता।",
      mr: "तुम्हाला आधीच नमो शेतकरी किंवा दुसरी राज्य मदत मिळत असल्यास फक्त ₹1,500 पर्यंतची उरलेली रक्कम मिळते (नमो शेतकरी शेतकऱ्यांना ₹500). कुटुंबाकडे चारचाकी असल्यास किंवा कुटुंबात सरकारी कर्मचारी असल्यास योजना मिळत नाही.",
    })),
    text: {
      en: { name: "Mukhyamantri Majhi Ladki Bahin Yojana", benefit: "Up to ₹1,500 every month into your Aadhaar-linked bank account.",
        documents: ["Aadhaar card", "Maharashtra domicile certificate or ration card", "Income certificate (a yellow or orange ration card also works)", "Aadhaar-linked bank account"] },
      hi: { name: "मुख्यमंत्री माझी लाडकी बहीण योजना", benefit: "हर महीने ₹1,500 तक, सीधे आधार से जुड़े बैंक खाते में।",
        documents: ["आधार कार्ड", "महाराष्ट्र अधिवास प्रमाणपत्र या राशन कार्ड", "आय प्रमाणपत्र (पीला या केसरी राशन कार्ड भी चलेगा)", "आधार से जुड़ा बैंक खाता"] },
      mr: { name: "मुख्यमंत्री माझी लाडकी बहीण योजना", benefit: "दरमहा ₹1,500 पर्यंत, थेट आधारशी जोडलेल्या बँक खात्यात.",
        documents: ["आधार कार्ड", "महाराष्ट्र अधिवास प्रमाणपत्र किंवा रेशन कार्ड", "उत्पन्नाचा दाखला (पिवळे किंवा केशरी रेशन कार्ड चालेल)", "आधारशी जोडलेले बँक खाते"] },
    },
  },
  {
    id: "lek-ladki",
    url: "https://womenchild.maharashtra.gov.in",
    source: "https://icds.gov.in/mr/node/624",
    checkedOn: CHECKED,
    // shortcut: age thresholds assume Oct 2026–Mar 2027, re-check after 1 Apr 2027
    check: (p) => decide(criteria(p, {
      state: inMaharashtra, rationCard: poorCard, annualFamilyIncome: (i) => i <= 100000,
      daughterAges: (d: number[]) => d.some((a) => a <= 3),
    }), () => likely({
      en: "Only for girls born on or after 1 April 2023 who are the family's first or second child; check the birth certificate.",
      hi: "सिर्फ़ 1 अप्रैल 2023 या उसके बाद जन्मी उन बेटियों के लिए जो परिवार की पहली या दूसरी संतान हों; जन्म प्रमाणपत्र देखें।",
      mr: "फक्त 1 एप्रिल 2023 किंवा त्यानंतर जन्मलेल्या, कुटुंबातील पहिल्या किंवा दुसऱ्या अपत्य असलेल्या मुलींसाठी; जन्म दाखला तपासा.",
    })),
    text: {
      en: { name: "Lek Ladki Yojana", benefit: "₹1,01,000 in stages for your daughter, from birth until she turns 18.",
        documents: ["Daughter's birth certificate", "Yellow or orange ration card", "Income certificate", "Parents' Aadhaar", "Bank passbook"] },
      hi: { name: "लेक लाडकी योजना", benefit: "बेटी के जन्म से 18 साल की उम्र तक किस्तों में कुल ₹1,01,000।",
        documents: ["बेटी का जन्म प्रमाणपत्र", "पीला या केसरी राशन कार्ड", "आय प्रमाणपत्र", "माता-पिता का आधार", "बैंक पासबुक"] },
      mr: { name: "लेक लाडकी योजना", benefit: "मुलीच्या जन्मापासून 18 वर्षांपर्यंत टप्प्याटप्प्याने एकूण ₹1,01,000.",
        documents: ["मुलीचा जन्म दाखला", "पिवळे किंवा केशरी रेशन कार्ड", "उत्पन्नाचा दाखला", "आई-वडिलांचे आधार", "बँक पासबुक"] },
    },
  },
  {
    id: "sukanya",
    url: "https://www.indiapost.gov.in",
    source: "https://www.valueresearchonline.com/stories/50239/all-you-need-to-know-about-sukanya-samriddhi-yojana",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { daughterAges: (d: number[]) => d.some((a) => a < 10) }), () => ELIGIBLE),
    text: {
      en: { name: "Sukanya Samriddhi Yojana", benefit: "A high-interest, tax-free savings account for your daughter at the post office or bank, from ₹250 a year.",
        documents: ["Daughter's birth certificate", "Parent's Aadhaar and PAN", "Address proof"] },
      hi: { name: "सुकन्या समृद्धि योजना", benefit: "बेटी के लिए डाकघर या बैंक में ऊँचे ब्याज वाला, टैक्स-फ़्री बचत खाता, साल में ₹250 से शुरू।",
        documents: ["बेटी का जन्म प्रमाणपत्र", "माता-पिता का आधार और पैन", "पते का प्रमाण"] },
      mr: { name: "सुकन्या समृद्धी योजना", benefit: "मुलीसाठी पोस्ट ऑफिस किंवा बँकेत जास्त व्याजाचे, करमुक्त बचत खाते, वर्षाला ₹250 पासून.",
        documents: ["मुलीचा जन्म दाखला", "पालकांचे आधार व पॅन", "पत्त्याचा पुरावा"] },
    },
  },
  {
    id: "apy",
    url: "https://financialservices.gov.in",
    source: "https://www.gconnect.in/orders-in-brief/pension/income-tax-payers-shall-not-eligible-atal-pension-yojana.html",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { age: (a) => a >= 18 && a <= 40, paysIncomeTax: (v) => v === false }), () => ELIGIBLE),
    text: {
      en: { name: "Atal Pension Yojana", benefit: "A guaranteed pension of ₹1,000 to ₹5,000 a month after age 60, for a small monthly saving.",
        documents: ["Aadhaar card", "Savings bank account", "Mobile number"] },
      hi: { name: "अटल पेंशन योजना", benefit: "थोड़ी मासिक बचत पर 60 साल के बाद हर महीने ₹1,000 से ₹5,000 तक की पक्की पेंशन।",
        documents: ["आधार कार्ड", "बचत बैंक खाता", "मोबाइल नंबर"] },
      mr: { name: "अटल पेन्शन योजना", benefit: "थोड्या मासिक बचतीवर वयाच्या 60 नंतर दरमहा ₹1,000 ते ₹5,000 पर्यंत खात्रीशीर पेन्शन.",
        documents: ["आधार कार्ड", "बचत बँक खाते", "मोबाइल नंबर"] },
    },
  },
  {
    id: "pm-vishwakarma",
    url: "https://pmvishwakarma.gov.in",
    source: "https://myscheme.gov.in/schemes/pmv",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { occupation: (o) => o === "artisan", age: (a) => a >= 18 }), () => likely({
      en: "For 18 traditional trades such as carpenter, tailor, potter, cobbler or barber; one person per family; no other government business loan in the last 5 years.",
      hi: "बढ़ई, दर्ज़ी, कुम्हार, मोची, नाई जैसे 18 पारंपरिक कामों के लिए; परिवार में एक व्यक्ति; पिछले 5 साल में कोई दूसरा सरकारी व्यवसाय-कर्ज़ नहीं।",
      mr: "सुतार, शिंपी, कुंभार, चर्मकार, नाभिक अशा 18 पारंपरिक व्यवसायांसाठी; कुटुंबातील एक व्यक्ती; गेल्या 5 वर्षांत दुसरे शासकीय व्यवसाय-कर्ज नाही.",
    })),
    text: {
      en: { name: "PM Vishwakarma", benefit: "Skill training with ₹500 a day, a ₹15,000 toolkit grant and loans up to ₹3 lakh at 5% interest.",
        documents: ["Aadhaar card", "Bank passbook", "Ration card"] },
      hi: { name: "पीएम विश्वकर्मा", benefit: "रोज़ ₹500 भत्ते के साथ कौशल प्रशिक्षण, ₹15,000 का टूलकिट और 5% ब्याज पर ₹3 लाख तक का कर्ज़।",
        documents: ["आधार कार्ड", "बैंक पासबुक", "राशन कार्ड"] },
      mr: { name: "पीएम विश्वकर्मा", benefit: "दररोज ₹500 भत्त्यासह कौशल्य प्रशिक्षण, ₹15,000 चे टूलकिट आणि 5% व्याजाने ₹3 लाखांपर्यंत कर्ज.",
        documents: ["आधार कार्ड", "बँक पासबुक", "रेशन कार्ड"] },
    },
  },
  {
    id: "pm-svanidhi",
    url: "https://pmsvanidhi.mohua.gov.in",
    source: "https://www.outlookmoney.com/news/pm-svanidhi-2025-updated-loan-limits-eligibility-and-how-street-vendors-can-apply",
    checkedOn: CHECKED,
    check: (p) => decide(criteria(p, { occupation: (o) => o === "street_vendor" }), () => likely({
      en: "You need a vending certificate or a recommendation letter from your municipality or Town Vending Committee.",
      hi: "नगर पालिका या टाउन वेंडिंग कमेटी से वेंडिंग प्रमाणपत्र या सिफ़ारिश पत्र चाहिए।",
      mr: "महानगरपालिका, नगरपालिका किंवा शहर फेरीवाला समितीकडून फेरीवाला प्रमाणपत्र किंवा शिफारसपत्र लागते.",
    })),
    text: {
      en: { name: "PM SVANidhi", benefit: "Loans for street vendors without any guarantee: ₹15,000, then ₹25,000, then ₹50,000, plus cashback on digital payments.",
        documents: ["Aadhaar card", "Vending certificate or recommendation letter", "Bank passbook"] },
      hi: { name: "पीएम स्वनिधि", benefit: "रेहड़ी-पटरी वालों को बिना गारंटी कर्ज़: पहले ₹15,000, फिर ₹25,000, फिर ₹50,000, और डिजिटल भुगतान पर कैशबैक।",
        documents: ["आधार कार्ड", "वेंडिंग प्रमाणपत्र या सिफ़ारिश पत्र", "बैंक पासबुक"] },
      mr: { name: "पीएम स्वनिधी", benefit: "फेरीवाल्यांना विनातारण कर्ज: आधी ₹15,000, मग ₹25,000, मग ₹50,000, आणि डिजिटल व्यवहारांवर कॅशबॅक.",
        documents: ["आधार कार्ड", "फेरीवाला प्रमाणपत्र किंवा शिफारसपत्र", "बँक पासबुक"] },
    },
  },
];
