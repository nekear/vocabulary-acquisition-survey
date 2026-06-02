import type {
  DomainInterest,
  LanguageCode,
  ProficiencyLevel,
  SchedulerKind,
} from "@/lib/constants";

export interface TargetLanguage {
  lang: LanguageCode;
  proficiency: ProficiencyLevel;
}

export interface UserProfile {
  native_languages: LanguageCode[];
  target_languages: TargetLanguage[];
  domain_interests: DomainInterest[];
}

export interface ParsedDeck {
  deck_id: number;
  name: string;
  parent_id: number | null;
  direct_card_count: number;
  fsrs_weights: number[];
  desired_retention: number;
  sort_index: number;
}

export type ModelKey = string;

export interface ParsedModelField {
  index: number;
  name: string;
}

export interface ParsedModel {
  model_id: number;
  fields: ParsedModelField[];
  field_names: string[];
}

export interface ParsedNote {
  note_id: number;
  model_id: number;
  fields: string[];
  tags: string[];
  created_at_ms: number;
}

export interface ParsedCard {
  card_id: number;
  note_id: number;
  deck_id: number;
  template_ord: number;
  state: number;
  queue: number;
  interval: number;
  factor: number;
  reps_total: number;
  lapses_total: number;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  due: number;
  created_at_ms: number;
}

export interface ParsedReview {
  review_id: number;
  card_id: number;
  timestamp_ms: number;
  rating: number;
  interval_before: number;
  interval_after: number;
  factor_after: number;
  time_taken_ms: number;
  review_type: number;
}

export interface ParsedCollection {
  collection_created_at_ms: number;
  schema_version: number | null;
  scheduler_version: number | null;
  decks: ParsedDeck[];
  models: ParsedModel[];
  notes: ParsedNote[];
  cards: ParsedCard[];
  reviews: ParsedReview[];
}

export interface IndexedParsedModel extends ParsedModel {
  model_key: ModelKey;
  payload_model_key: string;
  source_file_id: string;
  source_file_index: number;
  source_filename: string;
}

export interface IndexedParsedNote extends ParsedNote {
  model_key: ModelKey;
  payload_model_key: string;
  source_file_id: string;
  source_file_index: number;
  source_filename: string;
  note_key: string;
}

export interface IndexedParsedCard extends ParsedCard {
  source_file_id: string;
  source_file_index: number;
  source_filename: string;
  card_key: string;
  note_key: string;
}

export interface IndexedParsedReview extends ParsedReview {
  source_file_id: string;
  source_file_index: number;
  source_filename: string;
  card_key: string;
}

export interface ParsedFile {
  id: string;
  filename: string;
  data: ParsedCollection;
}

export interface DeckReviewConfig {
  retainedTags: Set<string>;
}

export type DeckReviewConfigRecord = Record<string, DeckReviewConfig>;

export interface DeckAssignment {
  target_language: LanguageCode | null;
  scheduler: SchedulerKind | null;
}

export type DeckAssignmentRecord = Record<string, DeckAssignment>;

export interface SubmissionDeck {
  deck_id: number;
  label: string;
  parent_id: number | null;
  target_language: LanguageCode | null;
  scheduler: SchedulerKind | null;
  fsrs_weights: number[];
  desired_retention: number;
}

export interface SubmissionModel {
  model_key: string;
  source_file_index: number;
  model_id: number;
  field_names: string[];
  excluded_field_indexes: number[];
}

export interface SubmissionNote {
  note_id: number;
  model_id: number;
  model_key: string;
  fields: Array<string | null>;
  tags: string[];
  created_at_ms: number;
}

export interface SubmissionCard {
  card_id: number;
  note_id: number;
  deck_id: number;
  template_ord: number;
  state: number;
  queue: number;
  interval: number;
  factor: number;
  reps_total: number;
  lapses_total: number;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  due: number;
  created_at_ms: number;
}

export interface SubmissionReview {
  card_id: number;
  timestamp_ms: number;
  rating: number;
  interval_before: number;
  interval_after: number;
  factor_after: number;
  time_taken_ms: number;
  review_type: number;
}

export interface SubmissionCollection {
  collection_created_at_ms: number;
  schema_version: number | null;
  scheduler_version: number | null;
  deck_ids: number[];
}

export interface SubmissionPayload {
  schema_version: string;
  previous_token: string | null;
  consent: {
    publish_revlogs: boolean;
    publish_userinfo: boolean;
  };
  user_profile: UserProfile;
  collections: SubmissionCollection[];
  decks: SubmissionDeck[];
  models: SubmissionModel[];
  notes: SubmissionNote[];
  cards: SubmissionCard[];
  reviews: SubmissionReview[];
}

export type StepNumber = 1 | 2 | 3 | 4;
export type ResearchStep = StepNumber | "confirmation";

export interface PendingConfirmation {
  submissionId: string;
  withdrawalToken: string | null;
  payloadJson: string;
}

export interface SubmissionDraft {
  sessionId: string;
  currentStep: StepNumber;
  previousToken: string;
  profilePrefilledFromLink: boolean;
  exportRequirementsAcknowledged: boolean;
  userProfile: UserProfile;
  parsedFiles: ParsedFile[];
  deckAssignments: DeckAssignmentRecord;
  deckReviewConfigs: DeckReviewConfigRecord;
  excludedNoteIds: Set<number>;
  excludedFieldsByModelKey: Record<ModelKey, Set<number>>;
  consent: {
    publish_revlogs: boolean;
    publish_userinfo: boolean;
  };
  pendingConfirmation: PendingConfirmation | null;
}

export interface SubmissionConfirmation {
  submissionId: string;
  withdrawalToken: string | null;
  payloadJson: string;
  submittedAtIso: string;
}

export interface LinkSubmissionRequest {
  previous_token: string;
}

export interface LinkSubmissionResponse {
  user_profile: UserProfile | null;
}

export interface InitSubmissionRequest {
  schema_version: string;
  previous_token: string | null;
  consent: {
    publish_revlogs: true;
    publish_userinfo: boolean;
  };
  user_profile: UserProfile;
  expected_size_bytes: number;
}

export interface InitSubmissionResponse {
  submission_id: string;
  upload_url: string;
  withdrawal_token?: string;
}

export interface ConfirmSubmissionResponse {
  ok: true;
}

export interface WithdrawSubmissionRequest {
  token: string;
}

export interface WithdrawSubmissionResponse {
  withdrawn_count: number;
}

export interface ApiErrorResponse {
  error: string;
  code:
    | "consent_revlogs_required"
    | "invalid_request"
    | "internal_error"
    | "payload_too_large"
    | "previous_token_not_found"
    | "submission_already_finalized"
    | "submission_not_found"
    | "token_not_found"
    | "upload_not_found";
  expected_size_bytes?: number;
  max_size_bytes?: number;
}

export interface FieldPiiMatch {
  fieldIndex: number;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  patternType: "digits" | "email" | "name" | "phone" | "url";
}

export interface SpecialCategoryMatch {
  category: "health" | "political" | "religious";
  matchedText: string;
}

export interface CardScanResult {
  cardId: number;
  noteId: number;
  matches: FieldPiiMatch[];
  specialMatches: SpecialCategoryMatch[];
}

export interface DeckScanResult {
  deckId: number;
  cardResults: Record<number, CardScanResult>;
  flaggedCardIds: Set<number>;
  specialCategoryCardIds: Set<number>;
}
