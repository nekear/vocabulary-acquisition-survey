import type {
  DeckAssignmentRecord,
  DeckReviewConfigRecord,
  ParsedCollection,
  ParsedDeck,
  SubmissionPayload,
  UserProfile,
} from "@/lib/types";
import {
  buildDeckLabels,
  buildSubmissionIndex,
  buildSubmissionPayloadFromPreparedData,
} from "@/lib/research";

/**
 * Captures the reviewed in-browser submission state that is allowed to flow
 * into the final payload.
 */
interface BuildSubmissionPayloadInput {
  previousToken: string;
  userProfile: UserProfile;
  publishRevlogs: boolean;
  publishUserinfo: boolean;
  parsedFiles: Array<{ id: string; filename: string; data: ParsedCollection }>;
  deckAssignments: DeckAssignmentRecord;
  deckReviewConfigs: DeckReviewConfigRecord;
  excludedNoteIds: Set<number>;
}

/**
 * Intersects retained tags across every related deck that shares the same note
 * so a tag survives only if all relevant deck privacy settings still allow it.
 */
function buildRetainedTagSetForNote(
  noteTags: string[],
  relatedDecks: ParsedDeck[],
  deckReviewConfigs: DeckReviewConfigRecord,
) {
  let retainedTags = new Set(noteTags);

  for (const deck of relatedDecks) {
    const config = deckReviewConfigs[String(deck.deck_id)];
    if (!config) {
      continue;
    }

    retainedTags = new Set(
      [...retainedTags].filter((tag) => config.retainedTags.has(tag)),
    );
  }

  return retainedTags;
}

/**
 * Converts reviewed parsed data into the exact payload shape uploaded to the
 * backend after privacy choices and deck configuration have been finalized.
 */
export function buildSubmissionPayload(
  input: BuildSubmissionPayloadInput,
): SubmissionPayload {
  // Building shared lookup state up front and rejecting incomplete deck
  // configuration in order to avoid assembling payload slices from invalid input.
  const index = buildSubmissionIndex(input.parsedFiles);
  const deckLabels = buildDeckLabels(index.decks);
  const missingSchedulerDeck = index.directDecks.find(
    (deck) => !input.deckAssignments[String(deck.deck_id)]?.scheduler,
  );

  if (missingSchedulerDeck) {
    throw new Error(
      `Select a scheduler for ${missingSchedulerDeck.name} before building the submission payload.`,
    );
  }

  // Shaping deck metadata with anonymized labels and reviewer-approved language/scheduler choices.
  const decks = index.decks.map((deck) => ({
    deck_id: deck.deck_id,
    label: deckLabels.get(deck.deck_id) ?? String(deck.deck_id),
    parent_id: deck.parent_id,
    target_language:
      input.deckAssignments[String(deck.deck_id)]?.target_language ?? null,
    scheduler: input.deckAssignments[String(deck.deck_id)]?.scheduler ?? null,
    fsrs_weights: deck.fsrs_weights,
    desired_retention: deck.desired_retention,
  }));

  // Preserving collection-level metadata per uploaded export so multi-file
  // submissions do not collapse differing schema or scheduler versions.
  const collections = input.parsedFiles.map((parsedFile) => {
    const collectionDeckIds = new Set(
      parsedFile.data.decks.map((deck) => deck.deck_id),
    );

    return {
      collection_created_at_ms: parsedFile.data.collection_created_at_ms,
      schema_version: parsedFile.data.schema_version ?? null,
      scheduler_version: parsedFile.data.scheduler_version ?? null,
      deck_ids: decks
        .filter((deck) => collectionDeckIds.has(deck.deck_id))
        .map((deck) => deck.deck_id),
    };
  });

  // Deduplicating models to keep the payload to one definition per model even
  // when the same model appears across multiple parsed files.
  const modelMap = new Map<number, SubmissionPayload["models"][number]>();
  for (const model of index.models) {
    if (!modelMap.has(model.model_id)) {
      modelMap.set(model.model_id, {
        model_id: model.model_id,
        field_names: model.field_names,
      });
    }
  }

  // Filtering notes by exclusion state and then applying the retained tags to the note-level data.
  const notes = index.notes
    .filter((note) => !input.excludedNoteIds.has(note.note_id))
    .map((note) => {
      const noteCards = index.cardsByNoteId.get(note.note_id) ?? [];
      const relatedDecks = noteCards
        .map((card) => index.deckMap.get(card.deck_id))
        .filter((deck): deck is ParsedDeck => Boolean(deck));
      const retainedTags = buildRetainedTagSetForNote(
        note.tags,
        relatedDecks,
        input.deckReviewConfigs,
      );

      // Applying tag retention here (at payload build time) to keep the
      // exported note data aligned with the final per-deck privacy decisions.
      return {
        note_id: note.note_id,
        model_id: note.model_id,
        fields: note.fields,
        tags: note.tags.filter((tag) => retainedTags.has(tag)),
        created_at_ms: note.created_at_ms,
      };
    });

  // Filtering cards with the same note-level boundary to prevent cards from
  // surviving after their parent note has been excluded from submission.
  const cards = index.cards
    .filter((card) => !input.excludedNoteIds.has(card.note_id))
    .map((card) => ({
      card_id: card.card_id,
      note_id: card.note_id,
      deck_id: card.deck_id,
      template_ord: card.template_ord,
      state: card.state,
      queue: card.queue,
      interval: card.interval,
      factor: card.factor,
      reps_total: card.reps_total,
      lapses_total: card.lapses_total,
      fsrs_stability: card.fsrs_stability,
      fsrs_difficulty: card.fsrs_difficulty,
      due: card.due,
      created_at_ms: card.created_at_ms,
    }));

  // Limiting review logs to cards that survived privacy review to prevent the
  // review history from outliving a removed note or card.
  const includedCardIds = new Set(cards.map((card) => card.card_id));

  const reviews = index.reviews
    .filter((review) => includedCardIds.has(review.card_id))
    .map((review) => ({
      card_id: review.card_id,
      timestamp_ms: review.timestamp_ms,
      rating: review.rating,
      interval_before: review.interval_before,
      interval_after: review.interval_after,
      factor_after: review.factor_after,
      time_taken_ms: review.time_taken_ms,
      review_type: review.review_type,
    }));

  // Handing the prepared slices to the final assembler to keep consent flags
  // and collection-level metadata construction centralized in one place.
  return buildSubmissionPayloadFromPreparedData({
    previousToken: input.previousToken,
    publishRevlogs: input.publishRevlogs,
    publishUserinfo: input.publishUserinfo,
    userProfile: input.userProfile,
    collections,
    decks,
    models: [...modelMap.values()],
    notes,
    cards,
    reviews,
  });
}
