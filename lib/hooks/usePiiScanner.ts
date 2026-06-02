"use client";

import { useMemo } from "react";

import type {
  CardScanResult,
  DeckScanResult,
  ParsedCard,
  ParsedCollection,
  ParsedFile,
  ParsedNote,
} from "@/lib/types";

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PATTERN =
  /(?:\+?[0-9]{1,4}[-.\s]?)?(?:\([0-9]{1,4}\)[-.\s]?)?[0-9]{2,4}[-.\s]?[0-9]{2,4}[-.\s]?[0-9]{2,4}/g;
const LONG_DIGIT_PATTERN = /\b[0-9]{6,}\b/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

const COMMON_NAMES = [
  "alex",
  "anna",
  "barack",
  "daniel",
  "david",
  "emma",
  "john",
  "james",
  "julia",
  "laura",
  "luca",
  "marco",
  "maria",
  "michael",
  "nina",
  "olivia",
  "pablo",
  "paul",
  "sarah",
  "sofia",
  "thomas",
];

const COMMON_SURNAMES = [
  "brown",
  "chen",
  "garcia",
  "jones",
  "kim",
  "lee",
  "martinez",
  "miller",
  "obama",
  "patel",
  "rossi",
  "smith",
  "trump",
  "wang",
  "putin",
];

const HEALTH_TERMS = [
  // English
  "anxiety",
  "cancer",
  "depression",
  "diagnosis",
  "disease",
  "doctor",
  "hospital",
  "illness",
  "medication",
  "patient",
  "prescription",
  "surgery",
  "therapy",
  "treatment",

  // German
  "angst",
  "arzt",
  "ärztin",
  "behandlung",
  "diagnose",
  "krankheit",
  "krankenhaus",
  "krebs",
  "medikament",
  "patient",
  "patientin",
  "rezept",
  "therapie",

  // Spanish
  "ansiedad",
  "cáncer",
  "depresión",
  "diagnóstico",
  "enfermedad",
  "hospital",
  "medicamento",
  "médico",
  "paciente",
  "receta",
  "terapia",
  "tratamiento",

  // French
  "anxiété",
  "cancer",
  "dépression",
  "diagnostic",
  "docteur",
  "hôpital",
  "maladie",
  "médecin",
  "médicament",
  "ordonnance",
  "patient",
  "thérapie",
  "traitement",

  // Italian
  "ansia",
  "cancro",
  "depressione",
  "diagnosi",
  "malattia",
  "medicinale",
  "medico",
  "ospedale",
  "paziente",
  "prescrizione",
  "terapia",
  "trattamento",

  // Portuguese
  "ansiedade",
  "câncer",
  "depressão",
  "diagnóstico",
  "doença",
  "hospital",
  "medicamento",
  "médico",
  "paciente",
  "receita",
  "terapia",
  "tratamento",

  // Dutch
  "angst",
  "depressie",
  "diagnose",
  "dokter",
  "geneesmiddel",
  "kanker",
  "patiënt",
  "recept",
  "therapie",
  "ziekenhuis",
  "ziekte",

  // Turkish
  "anksiyete",
  "depresyon",
  "doktor",
  "hastalık",
  "hastane",
  "hasta",
  "ilaç",
  "kanser",
  "reçete",
  "tedavi",
  "terapi",

  // Polish
  "choroba",
  "depresja",
  "diagnoza",
  "lekarstwo",
  "lekarz",
  "lęk",
  "pacjent",
  "rak",
  "recepta",
  "szpital",
  "terapia",
  "leczenie",

  // Russian
  "болезнь",
  "больница",
  "врач",
  "диагноз",
  "депрессия",
  "лечение",
  "лекарство",
  "пациент",
  "рак",
  "рецепт",
  "терапия",

  // Arabic
  "القلق",
  "سرطان",
  "اكتئاب",
  "تشخيص",
  "مرض",
  "طبيب",
  "مستشفى",
  "دواء",
  "مريض",
  "وصفة",
  "علاج",

  // Hindi
  "चिंता",
  "कैंसर",
  "अवसाद",
  "निदान",
  "बीमारी",
  "डॉक्टर",
  "अस्पताल",
  "दवा",
  "मरीज",
  "उपचार",

  // Chinese / Japanese / Korean
  "焦虑",
  "癌症",
  "抑郁",
  "诊断",
  "疾病",
  "医生",
  "医院",
  "药物",
  "患者",
  "治疗",
  "不安",
  "癌",
  "うつ病",
  "診断",
  "病気",
  "医師",
  "病院",
  "薬",
  "患者",
  "治療",
  "불안",
  "암",
  "우울증",
  "진단",
  "질병",
  "의사",
  "병원",
  "약",
  "환자",
  "치료",
];

const POLITICAL_TERMS = [
  // English
  "barack obama",
  "ballot",
  "democrat",
  "donald trump",
  "election",
  "government",
  "liberal",
  "obama",
  "parliament",
  "political party",
  "politician",
  "republican",
  "socialist",
  "trump",
  "vote",
  "republic",

  // German
  "bundestag",
  "regierung",
  "wahl",
  "wählen",
  "stimme",
  "partei",
  "politiker",
  "politikerin",
  "republik",
  "sozialist",
  "liberal",

  // Spanish
  "elección",
  "gobierno",
  "parlamento",
  "partido político",
  "político",
  "república",
  "votar",
  "voto",
  "socialista",
  "liberal",

  // French
  "élection",
  "gouvernement",
  "parlement",
  "parti politique",
  "politicien",
  "république",
  "socialiste",
  "vote",
  "voter",

  // Italian
  "elezione",
  "governo",
  "parlamento",
  "partito politico",
  "politico",
  "repubblica",
  "socialista",
  "votare",
  "voto",

  // Portuguese
  "eleição",
  "governo",
  "parlamento",
  "partido político",
  "político",
  "república",
  "socialista",
  "votar",
  "voto",

  // Dutch
  "verkiezing",
  "regering",
  "parlement",
  "politieke partij",
  "politicus",
  "republiek",
  "stem",
  "stemmen",
  "socialist",

  // Turkish
  "seçim",
  "hükümet",
  "parlamento",
  "siyasi parti",
  "politikacı",
  "cumhuriyet",
  "oy",
  "oy vermek",
  "sosyalist",

  // Polish
  "wybory",
  "rząd",
  "parlament",
  "partia polityczna",
  "polityk",
  "republika",
  "głos",
  "głosować",
  "socjalista",

  // Russian
  "выборы",
  "голос",
  "голосовать",
  "государство",
  "правительство",
  "парламент",
  "политик",
  "политическая партия",
  "республика",
  "социалист",

  // Arabic
  "انتخابات",
  "حكومة",
  "برلمان",
  "حزب سياسي",
  "سياسي",
  "جمهورية",
  "تصويت",
  "صوت",

  // Hindi
  "चुनाव",
  "सरकार",
  "संसद",
  "राजनीतिक दल",
  "राजनीतिज्ञ",
  "गणराज्य",
  "मतदान",
  "वोट",

  // Chinese / Japanese / Korean
  "选举",
  "政府",
  "议会",
  "政党",
  "政治家",
  "共和国",
  "投票",
  "選挙",
  "政府",
  "議会",
  "政党",
  "政治家",
  "共和国",
  "投票",
  "선거",
  "정부",
  "의회",
  "정당",
  "정치인",
  "공화국",
  "투표",
];

const RELIGIOUS_TERMS = [
  // English
  "bible",
  "buddhist",
  "church",
  "faith",
  "hindu",
  "islam",
  "jewish",
  "mosque",
  "muslim",
  "pray",
  "prayer",
  "religion",
  "synagogue",
  "temple",
  "buddha",

  // German
  "bibel",
  "buddhist",
  "christ",
  "glaube",
  "hindu",
  "islam",
  "jude",
  "kirche",
  "moschee",
  "muslim",
  "religion",
  "synagoge",
  "tempel",
  "gebet",

  // Spanish
  "biblia",
  "budista",
  "cristiano",
  "fe",
  "hindú",
  "iglesia",
  "islam",
  "judío",
  "mezquita",
  "musulmán",
  "oración",
  "religión",
  "sinagoga",
  "templo",

  // French
  "bible",
  "bouddhiste",
  "chrétien",
  "église",
  "foi",
  "hindou",
  "islam",
  "juif",
  "mosquée",
  "musulman",
  "prière",
  "religion",
  "synagogue",
  "temple",

  // Italian
  "bibbia",
  "buddista",
  "chiesa",
  "cristiano",
  "fede",
  "induista",
  "islam",
  "ebreo",
  "moschea",
  "musulmano",
  "preghiera",
  "religione",
  "sinagoga",
  "tempio",

  // Portuguese
  "bíblia",
  "budista",
  "cristão",
  "fé",
  "hindu",
  "igreja",
  "islam",
  "judeu",
  "mesquita",
  "muçulmano",
  "oração",
  "religião",
  "sinagoga",
  "templo",

  // Dutch
  "bijbel",
  "boeddhist",
  "christen",
  "geloof",
  "hindoe",
  "islam",
  "joods",
  "kerk",
  "moskee",
  "moslim",
  "religie",
  "synagoge",
  "tempel",
  "gebed",

  // Turkish
  "din",
  "dua",
  "hindu",
  "hristiyan",
  "incil",
  "islam",
  "kilise",
  "musevi",
  "müslüman",
  "sinagog",
  "tapınak",
  "cami",

  // Polish
  "biblia",
  "budda",
  "buddysta",
  "chrześcijanin",
  "hinduista",
  "islam",
  "kościół",
  "meczet",
  "modlitwa",
  "muzułmanin",
  "religia",
  "synagoga",
  "świątynia",
  "wiara",
  "żydowski",

  // Russian
  "библия",
  "будда",
  "буддист",
  "вера",
  "индуист",
  "ислам",
  "иудей",
  "мечеть",
  "молитва",
  "мусульманин",
  "религия",
  "синагога",
  "храм",
  "церковь",
  "христианин",

  // Arabic
  "القرآن",
  "الإنجيل",
  "الإسلام",
  "المسيحية",
  "اليهودية",
  "بوذي",
  "دين",
  "مسجد",
  "مسلم",
  "صلاة",
  "كنيسة",
  "معبد",
  "كنيس",

  // Hindi
  "धर्म",
  "बाइबल",
  "बौद्ध",
  "चर्च",
  "हिंदू",
  "इस्लाम",
  "यहूदी",
  "मस्जिद",
  "मुस्लिम",
  "प्रार्थना",
  "मंदिर",

  // Chinese / Japanese / Korean
  "宗教",
  "圣经",
  "佛教",
  "教堂",
  "信仰",
  "印度教",
  "伊斯兰",
  "犹太",
  "清真寺",
  "穆斯林",
  "祈祷",
  "寺庙",
  "宗教",
  "聖書",
  "仏教",
  "教会",
  "信仰",
  "ヒンドゥー",
  "イスラム",
  "ユダヤ",
  "モスク",
  "ムスリム",
  "祈り",
  "寺院",
  "종교",
  "성경",
  "불교",
  "교회",
  "신앙",
  "힌두교",
  "이슬람",
  "유대교",
  "모스크",
  "무슬림",
  "기도",
  "사원",
];

function collectMatches(
  pattern: RegExp,
  text: string,
  patternType: CardScanResult["matches"][number]["patternType"],
  fieldIndex: number,
) {
  const matches: CardScanResult["matches"] = [];
  const matcher = new RegExp(pattern.source, pattern.flags);
  let result: RegExpExecArray | null = matcher.exec(text);

  while (result) {
    const value = result[0];
    matches.push({
      fieldIndex,
      matchedText: value,
      startIndex: result.index,
      endIndex: result.index + value.length,
      patternType,
    });
    result = matcher.exec(text);
  }

  return matches;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildKeywordPattern(term: string) {
  const escapedTerm = escapeRegex(term);

  // CJK text is commonly written without spaces, so word-boundary style
  // matching would miss terms embedded in a sentence.
  if (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
      term,
    )
  ) {
    return new RegExp(escapedTerm, "giu");
  }

  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedTerm}(?![\\p{L}\\p{N}_])`,
    "giu",
  );
}

function findKeywordMatches(
  text: string,
  fieldIndex: number,
  patternType: CardScanResult["matches"][number]["patternType"],
  terms: string[],
) {
  const matches: CardScanResult["matches"] = [];

  for (const term of terms) {
    const matcher = buildKeywordPattern(term);
    let result = matcher.exec(text);

    while (result) {
      const value = result[0];
      matches.push({
        fieldIndex,
        matchedText: value,
        startIndex: result.index,
        endIndex: result.index + value.length,
        patternType,
      });
      result = matcher.exec(text);
    }
  }

  return matches;
}

function findSensitiveTermMatches(
  text: string,
  category: CardScanResult["specialMatches"][number]["category"],
  terms: string[],
) {
  const matches: CardScanResult["specialMatches"] = [];

  for (const term of terms) {
    const matcher = buildKeywordPattern(term);
    let result = matcher.exec(text);

    while (result) {
      matches.push({ category, matchedText: result[0] });
      result = matcher.exec(text);
    }
  }

  return matches;
}

function buildCardScan(card: ParsedCard, note: ParsedNote): CardScanResult {
  const matches: CardScanResult["matches"] = [];
  const specialMatches: CardScanResult["specialMatches"] = [];

  note.fields.forEach((field, fieldIndex) => {
    const plainText = stripHtml(field);
    if (!plainText) {
      return;
    }

    matches.push(
      ...collectMatches(EMAIL_PATTERN, plainText, "email", fieldIndex),
    );
    matches.push(
      ...collectMatches(PHONE_PATTERN, plainText, "phone", fieldIndex),
    );
    matches.push(
      ...collectMatches(LONG_DIGIT_PATTERN, plainText, "digits", fieldIndex),
    );
    matches.push(...collectMatches(URL_PATTERN, plainText, "url", fieldIndex));
    matches.push(
      ...findKeywordMatches(plainText, fieldIndex, "name", [
        ...COMMON_NAMES,
        ...COMMON_SURNAMES,
      ]),
    );

    specialMatches.push(
      ...findSensitiveTermMatches(plainText, "health", HEALTH_TERMS),
    );
    specialMatches.push(
      ...findSensitiveTermMatches(plainText, "political", POLITICAL_TERMS),
    );
    specialMatches.push(
      ...findSensitiveTermMatches(plainText, "religious", RELIGIOUS_TERMS),
    );
  });

  return {
    cardId: card.card_id,
    noteId: card.note_id,
    matches,
    specialMatches,
  };
}

function buildDeckScan(
  collection: ParsedCollection,
  deckId: number,
): DeckScanResult {
  const noteMap = new Map(collection.notes.map((note) => [note.note_id, note]));
  const deckCards = collection.cards.filter((card) => card.deck_id === deckId);
  const cardResults: Record<number, CardScanResult> = {};
  const flaggedCardIds = new Set<number>();
  const specialCategoryCardIds = new Set<number>();

  for (const card of deckCards) {
    const note = noteMap.get(card.note_id);
    if (!note) {
      continue;
    }

    const cardResult = buildCardScan(card, note);
    cardResults[card.card_id] = cardResult;

    if (cardResult.matches.length > 0) {
      flaggedCardIds.add(card.card_id);
    }
    if (cardResult.specialMatches.length > 0) {
      flaggedCardIds.add(card.card_id);
      specialCategoryCardIds.add(card.card_id);
    }
  }

  return {
    deckId,
    cardResults,
    flaggedCardIds,
    specialCategoryCardIds,
  };
}

export function usePiiScanner(
  parsedFiles: ParsedFile[],
  activeDeckId: number | null,
) {
  return useMemo(() => {
    if (activeDeckId === null) {
      return {
        deckScan: undefined as DeckScanResult | undefined,
        stripHtml,
      };
    }

    const parsedFile = parsedFiles.find((file) =>
      file.data.decks.some((deck) => deck.deck_id === activeDeckId),
    );

    return {
      deckScan: parsedFile
        ? buildDeckScan(parsedFile.data, activeDeckId)
        : undefined,
      stripHtml,
    };
  }, [activeDeckId, parsedFiles]);
}
