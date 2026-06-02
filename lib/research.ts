import {
  DECK_LABEL_PREFIX,
  SCHEMA_VERSION,
  SCHEDULER_OPTIONS,
  type LanguageCode,
  type SchedulerKind,
} from "@/lib/constants";
import type {
  CardScanResult,
  DeckAssignment,
  DeckAssignmentRecord,
  DeckReviewConfig,
  DeckReviewConfigRecord,
  DeckScanResult,
  FieldPiiMatch,
  IndexedParsedCard,
  IndexedParsedModel,
  IndexedParsedNote,
  IndexedParsedReview,
  ModelKey,
  ParsedCollection,
  ParsedDeck,
  ParsedFile,
  SpecialCategoryMatch,
  SubmissionPayload,
  UserProfile,
} from "@/lib/types";

/**
 * Aggregates parsed Anki entities and lookup tables into a single read-only
 * view that downstream UI and payload builders can query repeatedly.
 */
export interface SubmissionIndex {
  collections: ParsedCollection[];
  decks: ParsedDeck[];
  directDecks: ParsedDeck[];
  models: IndexedParsedModel[];
  notes: IndexedParsedNote[];
  cards: IndexedParsedCard[];
  reviews: IndexedParsedReview[];
  deckMap: Map<number, ParsedDeck>;
  modelMap: Map<number, IndexedParsedModel>;
  modelMapByKey: Map<ModelKey, IndexedParsedModel>;
  noteMap: Map<number, IndexedParsedNote>;
  noteMapByKey: Map<string, IndexedParsedNote>;
  cardMap: Map<number, IndexedParsedCard>;
  cardMapByKey: Map<string, IndexedParsedCard>;
  cardsByDeckId: Map<number, IndexedParsedCard[]>;
  cardsByNoteId: Map<number, IndexedParsedCard[]>;
  cardsByNoteKey: Map<string, IndexedParsedCard[]>;
  reviewsByCardId: Map<number, IndexedParsedReview[]>;
  reviewsByCardKey: Map<string, IndexedParsedReview[]>;
}

/**
 * Summarizes how many notes and cards in one deck remain included after the
 * participant's privacy review decisions have been applied.
 */
export interface DeckReviewStats {
  totalNotes: number;
  includedNotes: number;
  excludedNotes: number;
  totalCards: number;
  includedCards: number;
  excludedCards: number;
}

/**
 * Describes one card attached to a note review row, including its deck context
 * and the latest review metadata shown to the participant.
 */
export interface NoteReviewCardDetail {
  card: IndexedParsedCard;
  deck: ParsedDeck | null;
  reviewCount: number;
  latestReview: IndexedParsedReview | null;
}

/**
 * Represents one note-centered row in the privacy review UI, combining the
 * note, all related cards, review activity, and any PII scan findings.
 */
export interface NoteReviewRow {
  note: IndexedParsedNote;
  model: IndexedParsedModel | null;
  deckCards: IndexedParsedCard[];
  allCards: IndexedParsedCard[];
  cardDetails: NoteReviewCardDetail[];
  totalReviewCount: number;
  latestReview: IndexedParsedReview | null;
  fieldMatches: FieldPiiMatch[];
  specialMatches: SpecialCategoryMatch[];
  specialCategories: Array<SpecialCategoryMatch["category"]>;
  isFlagged: boolean;
  isExcluded: boolean;
}

export interface ModelFieldReviewFieldRow {
  fieldIndex: number;
  fieldName: string;
  isExcluded: boolean;
}

export interface ModelFieldReviewRow {
  modelKey: ModelKey;
  model: IndexedParsedModel;
  fields: ModelFieldReviewFieldRow[];
  deckNoteCount: number;
  submissionNoteCount: number;
  duplicateModelIdCount: number;
}

/** Returns an empty user profile shape suitable for initializing form state. */
export function emptyUserProfile(): UserProfile {
  return {
    native_languages: [],
    target_languages: [],
    domain_interests: [],
  };
}

/**
 * Fills in any missing user-profile fields so downstream code can rely on a
 * complete object instead of handling nullish arrays repeatedly.
 */
export function normalizeUserProfile(
  profile: Partial<UserProfile> | null | undefined,
): UserProfile {
  return {
    native_languages: profile?.native_languages ?? [],
    target_languages: profile?.target_languages ?? [],
    domain_interests: profile?.domain_interests ?? [],
  };
}

/** Narrows an unknown value to one of the scheduler identifiers we support. */
export function isSchedulerKind(value: unknown): value is SchedulerKind {
  return SCHEDULER_OPTIONS.includes(value as SchedulerKind);
}

export function buildModelKey(sourceFileId: string, modelId: number): ModelKey {
  return `${sourceFileId}:${modelId}`;
}

function buildSourceEntityKey(sourceFileId: string, entityId: number) {
  return `${sourceFileId}:${entityId}`;
}

function buildPayloadSourceLabel(sourceFileIndex: number) {
  return `file_${String(sourceFileIndex + 1).padStart(3, "0")}`;
}

function buildPayloadModelKey(sourceFileIndex: number, modelId: number) {
  return `${buildPayloadSourceLabel(sourceFileIndex)}:${modelId}`;
}

/**
 * Normalizes persisted or user-provided deck assignment data into the shape the
 * configuration UI and payload builder expect.
 */
export function normalizeDeckAssignment(
  value: unknown,
  fallbackScheduler: SchedulerKind | null = null,
): DeckAssignment {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const assignment = value as Partial<DeckAssignment>;
    return {
      target_language: assignment.target_language ?? null,
      scheduler: isSchedulerKind(assignment.scheduler)
        ? assignment.scheduler
        : fallbackScheduler,
    };
  }

  return {
    target_language: typeof value === "string" ? (value as LanguageCode) : null,
    scheduler: fallbackScheduler,
  };
}

/**
 * Creates a deck privacy-review config with the provided tags pre-selected for
 * retention.
 */
export function createEmptyDeckReviewConfig(
  tags: Iterable<string> = [],
): DeckReviewConfig {
  return {
    retainedTags: new Set<string>(tags),
  };
}

/**
 * Orders decks by parent-child hierarchy while preserving Anki's source order
 * among siblings, so labels and UI rows stay stable and predictable.
 */
export function sortDecksDepthFirst(decks: ParsedDeck[]): ParsedDeck[] {
  const childrenByParent = new Map<number | null, ParsedDeck[]>();

  for (const deck of decks) {
    const siblings = childrenByParent.get(deck.parent_id) ?? [];
    siblings.push(deck);
    childrenByParent.set(deck.parent_id, siblings);
  }

  const sortBySourceOrder = (items: ParsedDeck[]) =>
    items.sort((left, right) => left.sort_index - right.sort_index);

  const ordered: ParsedDeck[] = [];

  const visit = (parentId: number | null) => {
    const children = sortBySourceOrder([
      ...(childrenByParent.get(parentId) ?? []),
    ]);
    for (const child of children) {
      ordered.push(child);
      visit(child.deck_id);
    }
  };

  visit(null);
  return ordered;
}

/**
 * Builds the shared submission index that all later review, summary, and
 * payload-building steps use to avoid re-deriving relationships each time.
 */
export function buildSubmissionIndex(
  parsedFiles: ParsedFile[],
): SubmissionIndex {
  // Flattening parsed file contents into entity arrays to let the rest of the
  // review and submission flow index them consistently.
  const decks: ParsedDeck[] = [];
  const models: IndexedParsedModel[] = [];
  const notes: IndexedParsedNote[] = [];
  const cards: IndexedParsedCard[] = [];
  const reviews: IndexedParsedReview[] = [];

  parsedFiles.forEach((parsedFile, sourceFileIndex) => {
    const sourceFileId = parsedFile.id;
    const sourceFilename = parsedFile.filename;
    decks.push(...parsedFile.data.decks);

    models.push(
      ...parsedFile.data.models.map((model) => {
        const modelKey = buildModelKey(sourceFileId, model.model_id);
        return {
          ...model,
          model_key: modelKey,
          payload_model_key: buildPayloadModelKey(
            sourceFileIndex,
            model.model_id,
          ),
          source_file_id: sourceFileId,
          source_file_index: sourceFileIndex,
          source_filename: sourceFilename,
        };
      }),
    );

    notes.push(
      ...parsedFile.data.notes.map((note) => {
        const modelKey = buildModelKey(sourceFileId, note.model_id);
        return {
          ...note,
          model_key: modelKey,
          payload_model_key: buildPayloadModelKey(
            sourceFileIndex,
            note.model_id,
          ),
          source_file_id: sourceFileId,
          source_file_index: sourceFileIndex,
          source_filename: sourceFilename,
          note_key: buildSourceEntityKey(sourceFileId, note.note_id),
        };
      }),
    );

    cards.push(
      ...parsedFile.data.cards.map((card) => ({
        ...card,
        source_file_id: sourceFileId,
        source_file_index: sourceFileIndex,
        source_filename: sourceFilename,
        card_key: buildSourceEntityKey(sourceFileId, card.card_id),
        note_key: buildSourceEntityKey(sourceFileId, card.note_id),
      })),
    );

    reviews.push(
      ...parsedFile.data.reviews.map((review) => ({
        ...review,
        source_file_id: sourceFileId,
        source_file_index: sourceFileIndex,
        source_filename: sourceFilename,
        card_key: buildSourceEntityKey(sourceFileId, review.card_id),
      })),
    );
  });

  // Building direct ID lookups to let later code follow deck, note, card, and
  // model relationships without repeatedly scanning full arrays.
  const deckMap = new Map(decks.map((deck) => [deck.deck_id, deck]));
  const modelMap = new Map(models.map((model) => [model.model_id, model]));
  const modelMapByKey = new Map(
    models.map((model) => [model.model_key, model]),
  );
  const noteMap = new Map(notes.map((note) => [note.note_id, note]));
  const noteMapByKey = new Map(notes.map((note) => [note.note_key, note]));
  const cardMap = new Map(cards.map((card) => [card.card_id, card]));
  const cardMapByKey = new Map(cards.map((card) => [card.card_key, card]));
  const cardsByDeckId = new Map<number, IndexedParsedCard[]>();
  const cardsByNoteId = new Map<number, IndexedParsedCard[]>();
  const cardsByNoteKey = new Map<string, IndexedParsedCard[]>();
  const reviewsByCardId = new Map<number, IndexedParsedReview[]>();
  const reviewsByCardKey = new Map<string, IndexedParsedReview[]>();

  // Precomputing deck and note groupings to let privacy review and payload code
  // reason about shared notes and deck-local slices cheaply.
  for (const card of cards) {
    const deckCards = cardsByDeckId.get(card.deck_id) ?? [];
    deckCards.push(card);
    cardsByDeckId.set(card.deck_id, deckCards);

    const noteCards = cardsByNoteId.get(card.note_id) ?? [];
    noteCards.push(card);
    cardsByNoteId.set(card.note_id, noteCards);

    const sourceNoteCards = cardsByNoteKey.get(card.note_key) ?? [];
    sourceNoteCards.push(card);
    cardsByNoteKey.set(card.note_key, sourceNoteCards);
  }

  // Grouping reviews by card to let note-review rows and payload summaries
  // inspect review history without repeated filtering passes.
  for (const review of reviews) {
    const cardReviews = reviewsByCardId.get(review.card_id) ?? [];
    cardReviews.push(review);
    reviewsByCardId.set(review.card_id, cardReviews);

    const sourceCardReviews = reviewsByCardKey.get(review.card_key) ?? [];
    sourceCardReviews.push(review);
    reviewsByCardKey.set(review.card_key, sourceCardReviews);
  }

  // Preserving deck hierarchy and tracking decks with direct cards to keep
  // exported labels and UI ordering aligned with the original Anki structure.
  const orderedDecks = sortDecksDepthFirst(decks);

  return {
    collections: parsedFiles.map((parsedFile) => parsedFile.data),
    decks: orderedDecks,
    directDecks: orderedDecks.filter((deck) => deck.direct_card_count > 0),
    models,
    notes,
    cards,
    reviews,
    deckMap,
    modelMap,
    modelMapByKey,
    noteMap,
    noteMapByKey,
    cardMap,
    cardMapByKey,
    cardsByDeckId,
    cardsByNoteId,
    cardsByNoteKey,
    reviewsByCardId,
    reviewsByCardKey,
  };
}

/**
 * Collects the distinct note tags that currently appear in one deck so the
 * privacy review UI can decide which tags remain in the final payload.
 */
export function buildDeckTags(
  index: SubmissionIndex,
  deckId: number,
): string[] {
  const cards = index.cardsByDeckId.get(deckId) ?? [];
  const tags = new Set<string>();

  for (const card of cards) {
    const note = index.noteMapByKey.get(card.note_key);
    if (!note) {
      continue;
    }

    for (const tag of note.tags) {
      tags.add(tag);
    }
  }

  return [...tags].sort((left, right) => left.localeCompare(right));
}

/**
 * Rebuilds per-deck privacy-review configs after a new upload while preserving
 * only retained tags that still exist in the current parsed data.
 */
export function initializeDeckReviewConfigs(
  parsedFiles: ParsedFile[],
  existingConfigs: DeckReviewConfigRecord = {},
): DeckReviewConfigRecord {
  const index = buildSubmissionIndex(parsedFiles);
  const nextConfigs: DeckReviewConfigRecord = {};

  for (const deck of index.directDecks) {
    const existing = existingConfigs[String(deck.deck_id)];
    const tags = buildDeckTags(index, deck.deck_id);
    nextConfigs[String(deck.deck_id)] = existing
      ? {
          retainedTags: new Set(
            [...existing.retainedTags].filter((tag) => tags.includes(tag)),
          ),
        }
      : createEmptyDeckReviewConfig(tags);

    if (nextConfigs[String(deck.deck_id)].retainedTags.size === 0) {
      nextConfigs[String(deck.deck_id)].retainedTags = new Set(tags);
    }
  }

  return nextConfigs;
}

/**
 * Keeps only excluded note IDs that still exist in the current parsed upload,
 * preventing stale exclusions from affecting a different dataset.
 */
export function initializeExcludedNoteIds(
  parsedFiles: ParsedFile[],
  existingExcludedNoteIds: Set<number> = new Set<number>(),
): Set<number> {
  const index = buildSubmissionIndex(parsedFiles);

  return new Set(
    [...existingExcludedNoteIds].filter((noteId) => index.noteMap.has(noteId)),
  );
}

/**
 * Keeps only field-exclusion decisions that still reference models and field
 * ordinals present in the current upload.
 */
export function initializeExcludedFieldsByModelKey(
  parsedFiles: ParsedFile[],
  existingExcludedFieldsByModelKey: Record<ModelKey, Set<number>> = {},
): Record<ModelKey, Set<number>> {
  const index = buildSubmissionIndex(parsedFiles);
  const nextExcludedFieldsByModelKey: Record<ModelKey, Set<number>> = {};

  for (const model of index.models) {
    const existingFieldIndexes =
      existingExcludedFieldsByModelKey[model.model_key];
    if (!existingFieldIndexes) {
      continue;
    }

    const availableFieldIndexes = new Set(
      model.fields.map((field) => field.index),
    );
    const retainedFieldIndexes = [...existingFieldIndexes].filter(
      (fieldIndex) => availableFieldIndexes.has(fieldIndex),
    );

    if (retainedFieldIndexes.length > 0) {
      nextExcludedFieldsByModelKey[model.model_key] = new Set(
        retainedFieldIndexes,
      );
    }
  }

  return nextExcludedFieldsByModelKey;
}

/**
 * Rehydrates deck assignments for the currently uploaded direct-card decks,
 * discarding assignments for decks that are no longer present.
 */
export function initializeDeckAssignments(
  parsedFiles: ParsedFile[],
  existingAssignments: Record<string, unknown> = {},
  fallbackScheduler: SchedulerKind | null = null,
): DeckAssignmentRecord {
  const index = buildSubmissionIndex(parsedFiles);
  const nextAssignments: DeckAssignmentRecord = {};

  for (const deck of index.directDecks) {
    const key = String(deck.deck_id);
    nextAssignments[key] = normalizeDeckAssignment(
      existingAssignments[key],
      fallbackScheduler,
    );
  }

  return nextAssignments;
}

/**
 * Collapses overlapping or repeated field-level scan matches so the review UI
 * does not overstate how many times the same risky fragment was detected.
 */
function dedupeFieldMatches(matches: FieldPiiMatch[]) {
  const uniqueMatches = new Map<string, FieldPiiMatch>();

  for (const match of matches) {
    const key = [
      match.fieldIndex,
      match.patternType,
      match.startIndex,
      match.endIndex,
      match.matchedText,
    ].join(":");

    if (!uniqueMatches.has(key)) {
      uniqueMatches.set(key, match);
    }
  }

  return [...uniqueMatches.values()].sort((left, right) => {
    if (left.fieldIndex !== right.fieldIndex) {
      return left.fieldIndex - right.fieldIndex;
    }

    return left.startIndex - right.startIndex;
  });
}

/**
 * Deduplicates special-category findings that may be reported by multiple cards
 * for the same note, keeping the review row concise.
 */
function dedupeSpecialMatches(matches: SpecialCategoryMatch[]) {
  const uniqueMatches = new Map<string, SpecialCategoryMatch>();

  for (const match of matches) {
    const key = `${match.category}:${match.matchedText}`;
    if (!uniqueMatches.has(key)) {
      uniqueMatches.set(key, match);
    }
  }

  return [...uniqueMatches.values()].sort((left, right) =>
    left.category.localeCompare(right.category),
  );
}

/**
 * Returns the most recent review attached to one card, which the review UI uses
 * for context without exposing the full review history inline.
 */
function latestReviewForCard(
  reviewsByCardKey: SubmissionIndex["reviewsByCardKey"],
  cardKey: string,
) {
  const reviews = reviewsByCardKey.get(cardKey) ?? [];

  if (reviews.length === 0) {
    return null;
  }

  return [...reviews].sort(
    (left, right) => right.timestamp_ms - left.timestamp_ms,
  )[0];
}

/**
 * Sorts review rows so flagged notes appear first, making privacy-relevant
 * issues harder for participants and reviewers to miss.
 */
function sortNoteReviewRows(rows: NoteReviewRow[]) {
  return [...rows].sort((left, right) => {
    const leftFlagged = left.isFlagged ? 1 : 0;
    const rightFlagged = right.isFlagged ? 1 : 0;

    if (leftFlagged !== rightFlagged) {
      return rightFlagged - leftFlagged;
    }

    return left.note.note_id - right.note.note_id;
  });
}

/**
 * Builds the source-aware note-type field rows shown in the field review tab.
 */
export function buildDeckModelFieldReviewRows(
  index: SubmissionIndex,
  deckId: number,
  excludedFieldsByModelKey: Record<ModelKey, Set<number>>,
): ModelFieldReviewRow[] {
  const deckCards = index.cardsByDeckId.get(deckId) ?? [];
  const deckNoteKeysByModelKey = new Map<ModelKey, Set<string>>();
  const submissionNoteCountByModelKey = new Map<ModelKey, number>();
  const duplicateModelIdCountByModelId = new Map<number, number>();

  for (const model of index.models) {
    duplicateModelIdCountByModelId.set(
      model.model_id,
      (duplicateModelIdCountByModelId.get(model.model_id) ?? 0) + 1,
    );
  }

  for (const note of index.notes) {
    submissionNoteCountByModelKey.set(
      note.model_key,
      (submissionNoteCountByModelKey.get(note.model_key) ?? 0) + 1,
    );
  }

  for (const card of deckCards) {
    const note = index.noteMapByKey.get(card.note_key);
    if (!note) {
      continue;
    }

    const deckNoteKeys =
      deckNoteKeysByModelKey.get(note.model_key) ?? new Set<string>();
    deckNoteKeys.add(note.note_key);
    deckNoteKeysByModelKey.set(note.model_key, deckNoteKeys);
  }

  return [...deckNoteKeysByModelKey.entries()]
    .map(([modelKey, deckNoteKeys]) => {
      const model = index.modelMapByKey.get(modelKey);
      if (!model || model.fields.length === 0) {
        return null;
      }

      const excludedFieldIndexes =
        excludedFieldsByModelKey[modelKey] ?? new Set<number>();

      return {
        modelKey,
        model,
        fields: model.fields.map((field) => ({
          fieldIndex: field.index,
          fieldName: field.name,
          isExcluded: excludedFieldIndexes.has(field.index),
        })),
        deckNoteCount: deckNoteKeys.size,
        submissionNoteCount: submissionNoteCountByModelKey.get(modelKey) ?? 0,
        duplicateModelIdCount:
          duplicateModelIdCountByModelId.get(model.model_id) ?? 1,
      };
    })
    .filter((row): row is ModelFieldReviewRow => row !== null)
    .sort((left, right) => {
      if (left.model.model_id !== right.model.model_id) {
        return left.model.model_id - right.model.model_id;
      }

      return left.model.source_file_index - right.model.source_file_index;
    });
}

/**
 * Builds the note-centered rows shown in deck privacy review, combining cards,
 * reviews, scan findings, and exclusion state into one inspectable structure.
 */
export function buildDeckNoteReviewRows(
  index: SubmissionIndex,
  deckId: number,
  excludedNoteIds: Set<number>,
  deckScan?: DeckScanResult,
): NoteReviewRow[] {
  // Grouping cards from the active deck by note to reflect that privacy
  // decisions are made at the note level, not per individual card.
  const deckCards = index.cardsByDeckId.get(deckId) ?? [];
  const cardsByNoteKey = new Map<string, IndexedParsedCard[]>();

  for (const card of deckCards) {
    const noteCards = cardsByNoteKey.get(card.note_key) ?? [];
    noteCards.push(card);
    cardsByNoteKey.set(card.note_key, noteCards);
  }

  const rows: NoteReviewRow[] = [];

  // Assembling one review row per note to let the UI show shared cards,
  // findings, and exclusion status in a single place.
  for (const [noteKey, noteDeckCards] of cardsByNoteKey.entries()) {
    const note = index.noteMapByKey.get(noteKey);
    if (!note) {
      continue;
    }

    const allCards = index.cardsByNoteKey.get(noteKey) ?? noteDeckCards;
    const model = index.modelMapByKey.get(note.model_key) ?? null;

    // Aggregating scan findings at the note level to reflect that excluding a
    // note removes every card derived from it from the final submission payload.
    const cardResults = noteDeckCards
      .map((card) => deckScan?.cardResults[card.card_id])
      .filter((result): result is CardScanResult => Boolean(result));
    const fieldMatches = dedupeFieldMatches(
      cardResults.flatMap((result) => result.matches),
    );
    const specialMatches = dedupeSpecialMatches(
      cardResults.flatMap((result) => result.specialMatches),
    );

    // Ordering card details to show cards from the active deck first while
    // still exposing spillover cards from other decks that share the same note.
    const cardDetails = [...allCards]
      .sort((left, right) => {
        if (left.deck_id !== right.deck_id) {
          if (left.deck_id === deckId) {
            return -1;
          }
          if (right.deck_id === deckId) {
            return 1;
          }

          const leftDeck = index.deckMap.get(left.deck_id);
          const rightDeck = index.deckMap.get(right.deck_id);
          if (
            leftDeck &&
            rightDeck &&
            leftDeck.sort_index !== rightDeck.sort_index
          ) {
            return leftDeck.sort_index - rightDeck.sort_index;
          }
        }

        if (left.template_ord !== right.template_ord) {
          return left.template_ord - right.template_ord;
        }

        return left.card_id - right.card_id;
      })
      .map((card) => {
        const reviews = index.reviewsByCardKey.get(card.card_key) ?? [];
        return {
          card,
          deck: index.deckMap.get(card.deck_id) ?? null,
          reviewCount: reviews.length,
          latestReview: latestReviewForCard(
            index.reviewsByCardKey,
            card.card_key,
          ),
        };
      });

    // Summarizing all related reviews here to keep the row aligned with what
    // would be included if this note remains part of the final submission.
    const allReviews = cardDetails.flatMap(
      (detail) => index.reviewsByCardKey.get(detail.card.card_key) ?? [],
    );
    const latestReview =
      allReviews.length > 0
        ? [...allReviews].sort(
            (left, right) => right.timestamp_ms - left.timestamp_ms,
          )[0]
        : null;

    rows.push({
      note,
      model,
      deckCards: noteDeckCards,
      allCards,
      cardDetails,
      totalReviewCount: allReviews.length,
      latestReview,
      fieldMatches,
      specialMatches,
      specialCategories: Array.from(
        new Set(specialMatches.map((match) => match.category)),
      ),
      isFlagged: fieldMatches.length > 0 || specialMatches.length > 0,
      isExcluded: excludedNoteIds.has(note.note_id),
    });
  }

  return sortNoteReviewRows(rows);
}

/**
 * Computes how many notes and cards in one deck remain after note-level
 * exclusions are applied.
 */
export function computeDeckReviewStats(
  index: SubmissionIndex,
  excludedNoteIds: Set<number>,
  deckId: number,
): DeckReviewStats {
  // Counting deck cards first and then applying note-level exclusions to
  // capture cases where one excluded note removes multiple cards from a deck.
  const cards = index.cardsByDeckId.get(deckId) ?? [];
  const noteIds = new Set(cards.map((card) => card.note_id));
  let excludedCards = 0;

  for (const card of cards) {
    if (excludedNoteIds.has(card.note_id)) {
      excludedCards += 1;
    }
  }

  // Counting excluded notes separately to show both the note-level privacy
  // choices and their downstream effect on card counts.
  let excludedNotes = 0;
  for (const noteId of noteIds) {
    if (excludedNoteIds.has(noteId)) {
      excludedNotes += 1;
    }
  }

  return {
    totalNotes: noteIds.size,
    includedNotes: noteIds.size - excludedNotes,
    excludedNotes,
    totalCards: cards.length,
    includedCards: cards.length - excludedCards,
    excludedCards,
  };
}

/**
 * Produces a submission-wide summary after note-level exclusions have been
 * applied, mirroring what the final payload builder will include.
 */
export function computeSubmissionStats(
  index: SubmissionIndex,
  excludedNoteIds: Set<number>,
) {
  // Filtering notes and cards according to the participant's privacy choices to
  // keep the summary aligned with the payload that would actually be uploaded.
  const includedCards = index.cards.filter(
    (card) => !excludedNoteIds.has(card.note_id),
  );
  const includedCardKeys = new Set(includedCards.map((card) => card.card_key));
  const includedNotes = index.notes.filter(
    (note) => !excludedNoteIds.has(note.note_id),
  );

  // Including reviews only when their parent card survived note exclusion to
  // keep the summary within the same privacy boundary as the final payload.
  const includedReviews = index.reviews.filter((review) =>
    includedCardKeys.has(review.card_key),
  );

  return {
    deckCount: index.directDecks.length,
    totalNotes: index.notes.length,
    totalCards: index.cards.length,
    totalReviews: index.reviews.length,
    includedNotes: includedNotes.length,
    includedCards: includedCards.length,
    includedReviews: includedReviews.length,
    excludedNotes: index.notes.length - includedNotes.length,
    excludedCards: index.cards.length - includedCards.length,
  };
}

/**
 * Assigns stable anonymized deck labels used in exported payloads so reviewers
 * can discuss deck-level structure without relying on user-provided names.
 */
export function buildDeckLabels(decks: ParsedDeck[]) {
  return new Map(
    decks.map((deck, index) => [
      deck.deck_id,
      `${DECK_LABEL_PREFIX}${String(index + 1).padStart(3, "0")}`,
    ]),
  );
}

/** Serializes a submission payload for preview or download, optionally pretty-printed. */
export function createPayloadPreview(
  payload: SubmissionPayload,
  pretty = true,
): string {
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

/** Builds a timestamped download filename for locally generated review artifacts. */
export function buildDownloadFilename(prefix: string, extension: string) {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${iso}.${extension}`;
}

/**
 * Assembles the final submission payload from already prepared slices after all
 * filtering and review decisions have been applied.
 */
export function buildSubmissionPayloadFromPreparedData(input: {
  previousToken: string;
  publishUserinfo: boolean;
  publishRevlogs: boolean;
  userProfile: UserProfile;
  collections: SubmissionPayload["collections"];
  decks: SubmissionPayload["decks"];
  models: SubmissionPayload["models"];
  notes: SubmissionPayload["notes"];
  cards: SubmissionPayload["cards"];
  reviews: SubmissionPayload["reviews"];
}): SubmissionPayload {
  return {
    schema_version: SCHEMA_VERSION,
    previous_token: input.previousToken || null,
    consent: {
      publish_revlogs: input.publishRevlogs,
      publish_userinfo: input.publishUserinfo,
    },
    user_profile: input.userProfile,
    collections: input.collections,
    decks: input.decks,
    models: input.models,
    notes: input.notes,
    cards: input.cards,
    reviews: input.reviews,
  };
}
