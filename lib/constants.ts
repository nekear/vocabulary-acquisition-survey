export const SCHEMA_VERSION = "1.5";
export const SUBMISSION_MAX_BYTES = 49_000_000;
export const TOKEN_MIN_LENGTH = 32;
export const TOKEN_MAX_LENGTH = 64;
export const WITHDRAWAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
export const DECK_LABEL_PREFIX = "deck_";
export const RESEARCH_STORAGE_KEY = "research-submission-draft-v1";
export const DEFAULT_INFO_URL = "/research/overview";
export const SKIP_LANGUAGE_VALUE = "__skip__";

export const RESEARCH_STEPS = [
  { step: 1, label: "Profile" },
  { step: 2, label: "Upload" },
  { step: 3, label: "Configure" },
  { step: 4, label: "Done" },
] as const;

export const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "it", name: "Italian" },
  { code: "zh-Hans", name: "Chinese (Simplified)" },
  { code: "zh-Hant", name: "Chinese (Traditional)" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "uk", name: "Ukrainian" },
  { code: "pl", name: "Polish" },
  { code: "nl", name: "Dutch" },
  { code: "sv", name: "Swedish" },
  { code: "no", name: "Norwegian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "cs", name: "Czech" },
  { code: "ro", name: "Romanian" },
  { code: "hu", name: "Hungarian" },
  { code: "tr", name: "Turkish" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "fa", name: "Persian" },
  { code: "ur", name: "Urdu" },
  { code: "sr", name: "Serbian" },
  { code: "hr", name: "Croatian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "et", name: "Estonian" },
  { code: "ca", name: "Catalan" },
  { code: "gl", name: "Galician" },
  { code: "und", name: "Other / Unspecified" },
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

export const CEFR_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "Native",
  "Unsure",
] as const;

export type ProficiencyLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_LABELS: Record<ProficiencyLevel, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
  Native: "Native",
  Unsure: "Unsure / prefer not to say",
};

export const SCHEDULER_OPTIONS = ["SM2", "FSRS"] as const;

export type SchedulerKind = (typeof SCHEDULER_OPTIONS)[number];

export const DOMAIN_INTEREST_OPTIONS = [
  { value: "travel", label: "Travel" },
  { value: "cooking", label: "Cooking" },
  { value: "business", label: "Business" },
  { value: "academic", label: "Academic" },
  { value: "medical", label: "Medical" },
  { value: "legal", label: "Legal" },
  { value: "technology", label: "Technology / IT" },
  { value: "literature", label: "Literature" },
  { value: "pop_culture", label: "Pop Culture / Media" },
  { value: "music", label: "Music" },
  { value: "other", label: "Other" },
] as const;

export type DomainInterest = (typeof DOMAIN_INTEREST_OPTIONS)[number]["value"];

export const SPECIAL_CATEGORY_LABELS = {
  health: "health-related",
  political: "political",
  religious: "religious",
} as const;
