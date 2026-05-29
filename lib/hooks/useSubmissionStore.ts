"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { RESEARCH_STORAGE_KEY, type SchedulerKind } from "@/lib/constants";
import {
  buildSubmissionIndex,
  createEmptyDeckReviewConfig,
  emptyUserProfile,
  initializeDeckAssignments,
  initializeDeckReviewConfigs,
  initializeExcludedNoteIds,
  isSchedulerKind,
  normalizeUserProfile,
} from "@/lib/research";
import type {
  DeckAssignmentRecord,
  DeckReviewConfigRecord,
  ParsedFile,
  StepNumber,
  SubmissionConfirmation,
  SubmissionDraft,
  UserProfile,
} from "@/lib/types";

const SUBMISSION_STORE_VERSION = 6;

interface PersistedDeckReviewConfig {
  retainedTags: string[];
}

interface PersistedDraft extends Omit<
  SubmissionDraft,
  "deckReviewConfigs" | "excludedNoteIds"
> {
  deckReviewConfigs: Record<string, PersistedDeckReviewConfig>;
  excludedNoteIds: number[];
}

interface LegacyPersistedDeckConfig {
  excludedCardIds: number[];
  retainedTags: string[];
}

type LegacyUserProfile = Partial<UserProfile> & { scheduler?: unknown };

interface LegacyPersistedDraft extends Partial<
  Omit<
    SubmissionDraft,
    | "currentStep"
    | "deckAssignments"
    | "deckReviewConfigs"
    | "excludedNoteIds"
    | "userProfile"
  >
> {
  currentStep?: number;
  userProfile?: LegacyUserProfile;
  deckAssignments?: Record<string, unknown>;
  deckLanguageAssignments?: Record<string, unknown>;
  deckReviewConfigs?: Record<string, PersistedDeckReviewConfig>;
  deckConfigs?: Record<string, LegacyPersistedDeckConfig>;
  excludedNoteIds?: number[];
}

interface SubmissionStoreState {
  draft: SubmissionDraft;
  confirmation: SubmissionConfirmation | null;
  setCurrentStep: (step: StepNumber) => void;
  setLinkedProfile: (token: string, profile: UserProfile | null) => void;
  setUserProfile: (profile: UserProfile) => void;
  setParsedFiles: (parsedFiles: ParsedFile[]) => void;
  removeParsedFile: (fileId: string) => void;
  clearParsedFiles: () => void;
  setDeckAssignments: (assignments: DeckAssignmentRecord) => void;
  setNoteIncluded: (noteId: number, included: boolean) => void;
  setDeckTagRetained: (deckId: number, tag: string, retained: boolean) => void;
  setConsent: (partial: Partial<SubmissionDraft["consent"]>) => void;
  setPendingConfirmation: (
    value: SubmissionDraft["pendingConfirmation"],
  ) => void;
  clearPendingConfirmation: () => void;
  completeSubmission: (confirmation: SubmissionConfirmation) => void;
  resetDraft: () => void;
  clearConfirmation: () => void;
}

function createDraft(): SubmissionDraft {
  return {
    sessionId: crypto.randomUUID(),
    currentStep: 1,
    previousToken: "",
    profilePrefilledFromLink: false,
    exportRequirementsAcknowledged: false,
    userProfile: emptyUserProfile(),
    parsedFiles: [],
    deckAssignments: {},
    deckReviewConfigs: {},
    excludedNoteIds: new Set<number>(),
    consent: {
      publish_revlogs: false,
      publish_userinfo: false,
    },
    pendingConfirmation: null,
  };
}

function serializeDraft(draft: SubmissionDraft): PersistedDraft {
  return {
    ...draft,
    deckReviewConfigs: Object.fromEntries(
      Object.entries(draft.deckReviewConfigs).map(([deckId, config]) => [
        deckId,
        {
          retainedTags: [...config.retainedTags],
        },
      ]),
    ),
    excludedNoteIds: [...draft.excludedNoteIds],
  };
}

function deserializeDraft(value: PersistedDraft | undefined): SubmissionDraft {
  if (!value) {
    return createDraft();
  }

  const hasCurrentParsedFiles = parsedFilesUseCurrentSchema(value.parsedFiles);
  const parsedFiles = hasCurrentParsedFiles ? value.parsedFiles : [];
  const deckAssignments = hasCurrentParsedFiles
    ? initializeDeckAssignments(parsedFiles, value.deckAssignments)
    : {};
  const storedCurrentStep = normalizeStoredStep(value.currentStep);
  const currentStep = hasCurrentParsedFiles
    ? resetStepAfterMissingDeckScheduler(
        storedCurrentStep,
        parsedFiles,
        deckAssignments,
      )
    : resetStepAfterStaleParse(storedCurrentStep);

  return {
    ...value,
    currentStep,
    exportRequirementsAcknowledged:
      value.exportRequirementsAcknowledged ?? false,
    userProfile: normalizeUserProfile(value.userProfile),
    parsedFiles,
    deckAssignments,
    deckReviewConfigs: hasCurrentParsedFiles
      ? Object.fromEntries(
          Object.entries(value.deckReviewConfigs).map(([deckId, config]) => [
            deckId,
            {
              retainedTags: new Set(config.retainedTags),
            },
          ]),
        )
      : {},
    excludedNoteIds: new Set(
      hasCurrentParsedFiles ? value.excludedNoteIds : [],
    ),
  };
}

function parsedFilesUseCurrentSchema(parsedFiles: ParsedFile[] | undefined) {
  return (parsedFiles ?? []).every(
    (parsedFile) =>
      parsedFile.data.cards.every(
        (card) => "queue" in card && "interval" in card && "due" in card,
      ) &&
      parsedFile.data.reviews.every(
        (review) => "interval_before" in review && "interval_after" in review,
      ),
  );
}

function migrateLegacyStepToCurrent(step: number = 1): StepNumber {
  if (step <= 3) {
    return 1;
  }

  if (step === 4) {
    return 2;
  }

  if (step === 5 || step === 6) {
    return 3;
  }

  if (step === 7) {
    return 4;
  }

  return 1;
}

function normalizeStoredStep(step: number = 1): StepNumber {
  if (step === 1 || step === 2 || step === 3 || step === 4) {
    return step;
  }

  return migrateLegacyStepToCurrent(step);
}

function resetStepAfterStaleParse(step: StepNumber = 1): StepNumber {
  return step > 2 ? 2 : step;
}

function resetStepAfterMissingDeckScheduler(
  step: StepNumber = 1,
  parsedFiles: ParsedFile[],
  deckAssignments: DeckAssignmentRecord,
): StepNumber {
  if (step <= 3) {
    return step;
  }

  const index = buildSubmissionIndex(parsedFiles);
  return index.directDecks.some(
    (deck) => !deckAssignments[String(deck.deck_id)]?.scheduler,
  )
    ? 3
    : step;
}

function legacyProfileScheduler(
  profile: LegacyUserProfile | undefined,
): SchedulerKind | null {
  return isSchedulerKind(profile?.scheduler) ? profile.scheduler : null;
}

function migrateLegacyDraft(
  value: LegacyPersistedDraft | PersistedDraft | undefined,
): PersistedDraft {
  if (!value) {
    return serializeDraft(createDraft());
  }

  const legacyDraft = value as LegacyPersistedDraft;
  const parsedFiles = parsedFilesUseCurrentSchema(legacyDraft.parsedFiles)
    ? (legacyDraft.parsedFiles ?? [])
    : [];
  const index = buildSubmissionIndex(parsedFiles);
  const excludedNoteIds = new Set<number>();

  if (Array.isArray(legacyDraft.excludedNoteIds)) {
    for (const noteId of legacyDraft.excludedNoteIds) {
      excludedNoteIds.add(noteId);
    }
  } else {
    for (const config of Object.values(legacyDraft.deckConfigs ?? {})) {
      for (const cardId of config.excludedCardIds ?? []) {
        const card = index.cardMap.get(cardId);
        if (card) {
          excludedNoteIds.add(card.note_id);
        }
      }
    }
  }

  const deckReviewConfigs =
    parsedFiles.length > 0
      ? (legacyDraft.deckReviewConfigs ??
        Object.fromEntries(
          Object.entries(legacyDraft.deckConfigs ?? {}).map(
            ([deckId, config]) => [
              deckId,
              {
                retainedTags: [...(config.retainedTags ?? [])],
              },
            ],
          ),
        ))
      : {};

  const baseCurrentStep = migrateLegacyStepToCurrent(legacyDraft.currentStep);
  const legacyScheduler = legacyProfileScheduler(legacyDraft.userProfile);
  const deckAssignments =
    parsedFiles.length > 0
      ? initializeDeckAssignments(
          parsedFiles,
          legacyDraft.deckAssignments ??
            legacyDraft.deckLanguageAssignments ??
            {},
          legacyScheduler,
        )
      : {};
  const currentStep = resetStepAfterMissingDeckScheduler(
    baseCurrentStep,
    parsedFiles,
    deckAssignments,
  );

  return {
    sessionId: legacyDraft.sessionId ?? crypto.randomUUID(),
    currentStep,
    previousToken: legacyDraft.previousToken ?? "",
    profilePrefilledFromLink: legacyDraft.profilePrefilledFromLink ?? false,
    exportRequirementsAcknowledged:
      legacyDraft.exportRequirementsAcknowledged ?? false,
    userProfile: normalizeUserProfile(legacyDraft.userProfile),
    parsedFiles,
    deckAssignments,
    deckReviewConfigs,
    excludedNoteIds: parsedFiles.length > 0 ? [...excludedNoteIds] : [],
    consent: legacyDraft.consent ?? {
      publish_revlogs: false,
      publish_userinfo: false,
    },
    pendingConfirmation: legacyDraft.pendingConfirmation ?? null,
  } satisfies PersistedDraft;
}

export const useSubmissionStore = create<SubmissionStoreState>()(
  persist(
    (set) => ({
      draft: createDraft(),
      confirmation: null,
      setCurrentStep: (step) =>
        set((state) => ({
          draft: {
            ...state.draft,
            currentStep: step,
          },
        })),
      setLinkedProfile: (token, profile) =>
        set((state) => ({
          draft: {
            ...state.draft,
            previousToken: token,
            profilePrefilledFromLink: Boolean(profile),
            userProfile: profile
              ? normalizeUserProfile(profile)
              : state.draft.userProfile,
          },
        })),
      setUserProfile: (profile) =>
        set((state) => ({
          draft: {
            ...state.draft,
            userProfile: profile,
          },
        })),
      setParsedFiles: (parsedFiles) =>
        set((state) => ({
          draft: {
            ...state.draft,
            parsedFiles,
            deckAssignments: initializeDeckAssignments(
              parsedFiles,
              state.draft.deckAssignments,
            ),
            deckReviewConfigs: initializeDeckReviewConfigs(
              parsedFiles,
              state.draft.deckReviewConfigs,
            ),
            excludedNoteIds: initializeExcludedNoteIds(
              parsedFiles,
              state.draft.excludedNoteIds,
            ),
          },
        })),
      removeParsedFile: (fileId) =>
        set((state) => {
          const parsedFiles = state.draft.parsedFiles.filter(
            (file) => file.id !== fileId,
          );
          return {
            draft: {
              ...state.draft,
              parsedFiles,
              deckAssignments: initializeDeckAssignments(
                parsedFiles,
                state.draft.deckAssignments,
              ),
              deckReviewConfigs: initializeDeckReviewConfigs(
                parsedFiles,
                state.draft.deckReviewConfigs,
              ),
              excludedNoteIds: initializeExcludedNoteIds(
                parsedFiles,
                state.draft.excludedNoteIds,
              ),
            },
          };
        }),
      clearParsedFiles: () =>
        set((state) => ({
          draft: {
            ...state.draft,
            parsedFiles: [],
            deckAssignments: {},
            deckReviewConfigs: {},
            excludedNoteIds: new Set<number>(),
          },
        })),
      setDeckAssignments: (assignments) =>
        set((state) => ({
          draft: {
            ...state.draft,
            deckAssignments: assignments,
          },
        })),
      setNoteIncluded: (noteId, included) =>
        set((state) => {
          const excludedNoteIds = new Set(state.draft.excludedNoteIds);

          if (included) {
            excludedNoteIds.delete(noteId);
          } else {
            excludedNoteIds.add(noteId);
          }

          return {
            draft: {
              ...state.draft,
              excludedNoteIds,
            },
          };
        }),
      setDeckTagRetained: (deckId, tag, retained) =>
        set((state) => {
          const config =
            state.draft.deckReviewConfigs[String(deckId)] ??
            createEmptyDeckReviewConfig();
          const nextConfig = {
            retainedTags: new Set(config.retainedTags),
          };

          if (retained) {
            nextConfig.retainedTags.add(tag);
          } else {
            nextConfig.retainedTags.delete(tag);
          }

          return {
            draft: {
              ...state.draft,
              deckReviewConfigs: {
                ...state.draft.deckReviewConfigs,
                [String(deckId)]: nextConfig,
              },
            },
          };
        }),
      setConsent: (partial) =>
        set((state) => ({
          draft: {
            ...state.draft,
            consent: {
              ...state.draft.consent,
              ...partial,
            },
          },
        })),
      setPendingConfirmation: (value) =>
        set((state) => ({
          draft: {
            ...state.draft,
            pendingConfirmation: value,
          },
        })),
      clearPendingConfirmation: () =>
        set((state) => ({
          draft: {
            ...state.draft,
            pendingConfirmation: null,
          },
        })),
      completeSubmission: (confirmation) =>
        set(() => ({
          draft: createDraft(),
          confirmation,
        })),
      resetDraft: () =>
        set((state) => ({
          draft: createDraft(),
          confirmation: state.confirmation,
        })),
      clearConfirmation: () => set({ confirmation: null }),
    }),
    {
      name: RESEARCH_STORAGE_KEY,
      version: SUBMISSION_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        draft: serializeDraft(state.draft),
      }),
      migrate: (persistedState) => {
        const typedPersisted = persistedState as
          | { draft?: PersistedDraft | LegacyPersistedDraft }
          | undefined;
        return {
          draft: migrateLegacyDraft(typedPersisted?.draft),
        };
      },
      merge: (persistedState, currentState) => {
        const typedPersisted = persistedState as
          | { draft?: PersistedDraft }
          | undefined;
        return {
          ...currentState,
          draft: deserializeDraft(typedPersisted?.draft),
        };
      },
    },
  ),
);
